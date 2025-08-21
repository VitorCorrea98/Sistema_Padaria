import { pipe } from "effect";
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

type ControllerConfig<
	T extends TAllowedRequestKeys,
	E,
	TLocals = Record<string, unknown>,
> = {
	service: (
		input: TExtractedRequest<T, TLocals>,
	) => Effect.Effect<ServiceResponse, E>;
	requestKeys: T[];
	middlewares: RequestHandler[];
	providers: [Layer.Layer<unknown, never>] | undefined;
	errorHandler?: (e: E) => ServiceErrorResponse; // Optional for custom error mapping
};

const genericController = <
	T extends TAllowedRequestKeys,
	E,
	TLocals = Record<string, unknown>,
>(
	config: ControllerConfig<T, E, TLocals>,
): RequestHandler[] => [
	...config.middlewares,
	(req: Request, res: Response, next: NextFunction) => {
		const input = getRequestObjectKeys<T, TLocals>(
			config.requestKeys,
			req,
			res,
		);
		const mergedLayers = config.providers
			? Layer.mergeAll(...config.providers)
			: Layer.empty;

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

const myService: TGenericService<MyInput, MyServiceResponse> = (
	input: MyInput,
): Effect.Effect<ServiceResponse<MyServiceResponse>, Error, never> =>
	Effect.succeed({
		status: "OK",
		message: "My service executed successfully",
		data: {
			name: input.body.name,
		},
	});

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

const MiddlewareCheckUser: TypedMiddleware<
	MyInput, // Specifies it uses req.body
	{ user: string } // Adds 'user' to outgoing locals
> = (req, res, next) => {
	if (req.body.name !== "validUser") {
		res.status(401).json({
			status: "BAD_REQUEST",
			message: "User not authenticated",
			error: "FEfe",
		} as ServiceErrorResponse);
		return;
	}
	res.locals.user = "authenticated-user"; // Set locals
	next();
	return;
};

const MiddlewareCheckUser2: TypedMiddleware<
	MyInput, // Specifies it uses req.body
	{ user: string } // Adds 'user' to outgoing locals
> = (req, res, next) => {
	if (req.body.name !== "fef") {
		res.status(422).json({
			status: "BAD_REQUEST",
			message: "User not authenticated",
			error: "TESTA",
		} as ServiceErrorResponse);
		return;
	}
	res.locals.user = "authenticated-user"; // Set locals
	next();
	return;
};

const myControllerConfig: ControllerConfig<
	keyof MyInput,
	Error,
	{ user: string }
> = {
	service: myService,
	requestKeys: ["body", "locals"],
	middlewares: [asRequestHandler([MiddlewareCheckUser, MiddlewareCheckUser2])],
	providers: undefined,
	errorHandler: (e) => ({
		status: "CONFLICT",
		message: "An error occurred",
		error: e.message,
	}),
};

export const myController: RequestHandler[] =
	genericController(myControllerConfig);
