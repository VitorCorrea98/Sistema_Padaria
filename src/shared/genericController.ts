import { Context, pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { NextFunction, Request, RequestHandler, Response } from "express";

const HTTPGoodStatus = {
	OK: 200,
	CREATED: 201,
	ACCEPTED: 202,
	NO_CONTENT: 204,
	PARTIAL_CONTENT: 206,
} as const;

const HTTPBadStatus = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	REQUEST_TIMEOUT: 408,
	CONFLICT: 409,
	UNPROCESSABLE_ENTITY: 422,
	TOO_MANY_REQUESTS: 429,
} as const;

const HTTPServerErrorStatus = {
	INTERNAL_SERVER_ERROR: 500,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504,
} as const;

const HTTPStatusMap = {
	...HTTPGoodStatus,
	...HTTPBadStatus,
	...HTTPServerErrorStatus,
} as const;

type TGoodStatus = keyof typeof HTTPGoodStatus;

type TBadStatus = keyof typeof HTTPBadStatus;

type TServerStatus = keyof typeof HTTPServerErrorStatus;

type HTTPResponseStatus = keyof typeof HTTPStatusMap;

const getHTTPStatus = (status: HTTPResponseStatus) => HTTPStatusMap[status];

type ServiceSuccessResponse<T = unknown> = {
	status: TGoodStatus;
	message: string;
	data?: T;
};

type ServiceErrorResponse<T = unknown> = {
	status: TBadStatus | TServerStatus;
	message: string;
	error: T;
};

type ServiceResponse<T = unknown> =
	| ServiceSuccessResponse<T>
	| ServiceErrorResponse;

type TAllowedRequestKeys = "body" | "params" | "query" | "headers" | "locals";

type TExtractedRequest<
	T extends TAllowedRequestKeys,
	TLocals = Record<string, unknown>,
> = {
	[K in T]: K extends "locals"
		? TLocals
		: K extends keyof Request
			? Request[K]
			: never;
};

const getRequestObjectKeys = <
	T extends TAllowedRequestKeys,
	TLocals = Record<string, unknown>,
>(
	keys: T[],
	req: Request,
	res: Response,
): TExtractedRequest<T, TLocals> => {
	const result = {} as TExtractedRequest<T, TLocals>;
	for (const key of keys) {
		result[key] = key === "locals" ? res.locals : req[key as keyof Request];
	}
	return result;
};
type ControllerConfig<T extends TAllowedRequestKeys, E, TLocals, R> = {
	service: (
		input: TExtractedRequest<T, TLocals>,
	) => Effect.Effect<ServiceResponse, E, R>;
	requestKeys: T[];
	middlewares: RequestHandler[];
	providers: [Layer.Layer<R, never, never>];
	errorHandler?: (e: E) => ServiceErrorResponse;
};

const genericController = <T extends TAllowedRequestKeys, E, TLocals, R>(
	config: ControllerConfig<T, E, TLocals, R>,
): RequestHandler[] => [
	...config.middlewares,
	(req: Request, res: Response, next: NextFunction) => {
		const input = getRequestObjectKeys<T, TLocals>(
			config.requestKeys,
			req,
			res,
		);
		const mergedLayers = Layer.mergeAll(...config.providers) ?? Layer.empty;

		const program = pipe(
			config.service(input),
			Effect.catchAll((e) =>
				Effect.succeed(
					config.errorHandler
						? config.errorHandler(e)
						: ({
								status: "CONFLICT",
								error: "Internal error",
							} as ServiceErrorResponse),
				),
			),
			Effect.provide(mergedLayers),
		);

		Effect.runPromise(program)
			.then((response) => {
				res.status(getHTTPStatus(response.status)).json(response);
			})
			.catch((err) => next(err));
	},
];

interface Database {
	findUser(id: number): Effect.Effect<{ id: number; name: string }, Error>;
}
const Database = Context.GenericTag<Database>("Database");

const DatabaseLive = Layer.succeed(Database, {
	findUser: (id) =>
		id === 1
			? Effect.succeed({ id: 1, name: "Alice" })
			: Effect.fail(new Error("User not found")),
});

interface Logger {
	log(message: string): Effect.Effect<void, never>;
}

const Logger = Context.GenericTag<Logger>("Logger");

const ConsoleLogger: Logger = {
	log: (message: string) => Effect.sync(() => console.log(message)),
};

interface MyInput {
	body: { name: string; id: number };
	locals: { user: string };
}

interface MyServiceResponse {
	name: string;
}

type TGenericService<TInput, TResponse, E = Error, R = never> = (
	input: TInput,
) => Effect.Effect<ServiceResponse<TResponse>, E, R>;

const myService: TGenericService<
	MyInput,
	MyServiceResponse,
	Error,
	Database
> = (input: MyInput) =>
	pipe(
		Database,
		Effect.flatMap((db) => db.findUser(input.body.id)),
		Effect.map((user) => ({
			status: "OK",
			message: "User fetched",
			data: { name: user.name },
		})),
	);

type TypedMiddleware<
	TInput,
	TLocalsOut extends Record<string, unknown>,
> = RequestHandler<
	TInput extends { params: infer P } ? P : unknown,
	unknown,
	TInput extends { body: infer B } ? B : unknown,
	TInput extends { query: infer Q } ? Q : unknown,
	Record<string, unknown> & TLocalsOut
>;

const asRequestHandler = <TInput, TLocalsOut extends Record<string, unknown>>(
	mw: TypedMiddleware<TInput, TLocalsOut>[],
): RequestHandler => mw as unknown as RequestHandler;

const MiddlewareCheckUser: TypedMiddleware<MyInput, { user: string }> = (
	req,
	res,
	next,
) => {
	const program = pipe(
		Effect.fromNullable(req.body.name === "validUser" ? req.body : null),
		Effect.mapError(() => ({
			status: "UNAUTHORIZED" as const,
			message: "User not authenticated",
			error: "Invalid user",
		})),
		Effect.tap(() =>
			Effect.sync(() => {
				res.locals.user = "authenticated-user";
			}),
		),
	);

	Effect.runPromiseExit(program).then((exit) => {
		if (exit._tag === "Failure") {
			res.status(getHTTPStatus("BAD_REQUEST")).json(exit.cause);
		} else {
			next();
		}
	});
};

const MiddlewareCheckUser2: TypedMiddleware<
	MyInput, // Specifies it uses req.body
	{ user: string } // Adds 'user' to outgoing locals
> = (_req, res, next) => {
	if (res.locals.user !== "authenticated-user") {
		res.status(422).json({
			status: "BAD_REQUEST",
			message: "User not authenticated",
			error: "TESTA",
		} as ServiceErrorResponse);
		return;
	}
	next();
	return;
};

const myControllerConfig: ControllerConfig<
	keyof MyInput,
	Error,
	{ user: string },
	Database
> = {
	service: myService,
	requestKeys: ["body", "locals"],
	middlewares: [asRequestHandler([MiddlewareCheckUser, MiddlewareCheckUser2])],
	providers: [DatabaseLive],
	errorHandler: (e) => ({
		status: "CONFLICT",
		message: "An error occurred",
		error: e.message,
	}),
};

export const myController: RequestHandler[] =
	genericController(myControllerConfig);
