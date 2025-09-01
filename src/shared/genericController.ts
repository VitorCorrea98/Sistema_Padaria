// import { Context, pipe } from "effect";
// import * as Effect from "effect/Effect";
// import * as Layer from "effect/Layer";
// import type { NextFunction, Request, RequestHandler, Response } from "express";

// const HTTPGoodStatus = {
// 	OK: 200,
// 	CREATED: 201,
// 	ACCEPTED: 202,
// 	NO_CONTENT: 204,
// 	PARTIAL_CONTENT: 206,
// } as const;

// const HTTPBadStatus = {
// 	BAD_REQUEST: 400,
// 	UNAUTHORIZED: 401,
// 	FORBIDDEN: 403,
// 	NOT_FOUND: 404,
// 	METHOD_NOT_ALLOWED: 405,
// 	REQUEST_TIMEOUT: 408,
// 	CONFLICT: 409,
// 	UNPROCESSABLE_ENTITY: 422,
// 	TOO_MANY_REQUESTS: 429,
// } as const;

// const HTTPServerErrorStatus = {
// 	INTERNAL_SERVER_ERROR: 500,
// 	BAD_GATEWAY: 502,
// 	SERVICE_UNAVAILABLE: 503,
// 	GATEWAY_TIMEOUT: 504,
// } as const;

// const HTTPStatusMap = {
// 	...HTTPGoodStatus,
// 	...HTTPBadStatus,
// 	...HTTPServerErrorStatus,
// } as const;

// type TGoodStatus = keyof typeof HTTPGoodStatus;
// type TBadStatus = keyof typeof HTTPBadStatus;
// type TServerStatus = keyof typeof HTTPServerErrorStatus;
// type HTTPResponseStatus = keyof typeof HTTPStatusMap;

// const getHTTPStatus = (status: HTTPResponseStatus) => HTTPStatusMap[status];

// type ServiceSuccessResponse<T = unknown> = {
// 	status: TGoodStatus;
// 	message: string;
// 	data: T;
// };

// type ServiceErrorResponse = {
// 	status: TBadStatus | TServerStatus;
// 	message: string;
// 	error: unknown;
// };

// type ServiceResponse<T = unknown> =
// 	| ServiceSuccessResponse<T>
// 	| ServiceErrorResponse;

// type TAllowedRequestKeys = "body" | "params" | "query" | "headers" | "locals";

// type TExtractedRequest<
// 	T extends TAllowedRequestKeys,
// 	TLocals = Record<string, unknown>,
// > = {
// 	[K in T]: K extends "locals"
// 		? TLocals
// 		: K extends keyof Request
// 			? Request[K]
// 			: never;
// };

// const getRequestObjectKeys = <
// 	T extends TAllowedRequestKeys,
// 	TLocals = Record<string, unknown>,
// >(
// 	keys: T[],
// 	req: Request,
// 	res: Response,
// ): TExtractedRequest<T, TLocals> => {
// 	const result = {} as TExtractedRequest<T, TLocals>;
// 	for (const key of keys) {
// 		result[key] = key === "locals" ? res.locals : req[key as keyof Request];
// 	}
// 	return result;
// };

// type ControllerConfig<
// 	T extends TAllowedRequestKeys,
// 	E,
// 	TLocals,
// 	Ls extends readonly Layer.Layer<any, never, never>[],
// > = {
// 	service: (
// 		input: TExtractedRequest<T, TLocals>,
// 	) => Effect.Effect<ServiceResponse, E, unknown>;
// 	requestKeys: T[];
// 	middlewares: RequestHandler[];
// 	providers: Ls;
// 	errorHandler?: (e: E) => ServiceErrorResponse;
// };

// const genericController = <
// 	T extends TAllowedRequestKeys,
// 	E,
// 	TLocals,
// 	Ls extends readonly Layer.Layer<any, never, never>[],
// >(
// 	config: ControllerConfig<T, E, TLocals, Ls>,
// ): RequestHandler[] => [
// 	...config.middlewares,
// 	(req: Request, res: Response, next: NextFunction) => {
// 		const input = getRequestObjectKeys<T, TLocals>(
// 			config.requestKeys,
// 			req,
// 			res,
// 		);

// 		const mergedLayers = Layer.mergeAll(
// 			...(config.providers as unknown as [
// 				Layer.Layer<unknown, never, never>,
// 				...Layer.Layer<unknown, never, never>[],
// 			]),
// 		);

// 		const program = pipe(
// 			config.service(input),
// 			Effect.catchAll((e) =>
// 				Effect.succeed(
// 					config.errorHandler
// 						? config.errorHandler(e)
// 						: ({
// 								status: "CONFLICT",
// 								message: "Internal error",
// 								error: String(e),
// 							} satisfies ServiceErrorResponse),
// 				),
// 			),
// 			Effect.provide(mergedLayers),
// 		);

// 		Effect.runPromise(program)
// 			.then((response) => {
// 				res.status(getHTTPStatus(response.status)).json(response);
// 			})
// 			.catch((err) => next(err));
// 	},
// ];

// interface ILogger {
// 	info: (msg: string) => Effect.Effect<void>;
// 	error: (msg: string) => Effect.Effect<void>;
// }
// const Logger = Context.GenericTag<ILogger>("Logger");

// const LoggerLive = Layer.succeed(Logger, {
// 	info: (message: string) => Effect.logInfo(message),
// 	error: (message: string) => Effect.logError(message),
// });

// interface IDatabase {
// 	findUser(id: number): Effect.Effect<{ id: number; name: string }, Error>;
// }
// const Database = Context.GenericTag<IDatabase>("Database");

// const DatabaseLive = Layer.effect(
// 	Database,
// 	Effect.succeed({
// 		findUser: (id: number) => Effect.succeed({ id, name: `User${id}` }),
// 	}),
// );

// interface MyInput {
// 	body: { name: string; id: number };
// 	locals: { user: string };
// }

// interface MyServiceResponse {
// 	name: string;
// }

// type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
// 	x: infer I,
// ) => void
// 	? I
// 	: never;

// type MergeTags<Ls extends readonly Layer.Layer<any, any, any>[]> =
// 	Ls extends readonly Layer.Layer<infer R, any, any>[]
// 		? UnionToIntersection<R>
// 		: never;

// type TGenericService<
// 	TInput,
// 	TResponse,
// 	E,
// 	Ls extends readonly Layer.Layer<any, never, never>[],
// > = (
// 	input: TInput,
// ) => Effect.Effect<ServiceResponse<TResponse>, E, MergeTags<Ls>>;

// const myService: TGenericService<
// 	MyInput,
// 	MyServiceResponse,
// 	Error,
// 	[typeof DatabaseLive & typeof LoggerLive]
// > = (input: MyInput) =>
// 	pipe(
// 		Logger,
// 		Effect.flatMap((logger) =>
// 			pipe(
// 				Database,
// 				Effect.flatMap((db) => db.findUser(input.body.id)),
// 				Effect.tap((user) => logger.info(`Found user: ${user.name}`)),
// 				Effect.map(
// 					(user) =>
// 						({
// 							status: "OK",
// 							message: "User found",
// 							data: { name: user.name },
// 						}) satisfies ServiceSuccessResponse<MyServiceResponse>,
// 				),
// 			),
// 		),
// 	);

// type TypedMiddleware<
// 	TInput,
// 	TLocalsOut extends Record<string, unknown>,
// > = RequestHandler<
// 	TInput extends { params: infer P } ? P : unknown,
// 	unknown,
// 	TInput extends { body: infer B } ? B : unknown,
// 	TInput extends { query: infer Q } ? Q : unknown,
// 	Record<string, unknown> & TLocalsOut
// >;

// const asRequestHandler = <TInput, TLocalsOut extends Record<string, unknown>>(
// 	mw: TypedMiddleware<TInput, TLocalsOut>[],
// ): RequestHandler[] => mw as unknown as RequestHandler[];

// const MiddlewareCheckUser: TypedMiddleware<MyInput, { user: string }> = (
// 	req,
// 	res,
// 	next,
// ) => {
// 	const program = pipe(
// 		Effect.filterOrFail(
// 			Effect.succeed(req.body),
// 			(body) => body.name === "validUser",
// 			() => ({
// 				status: "UNAUTHORIZED" as const,
// 				message: "User not authenticated",
// 				error: "Invalid user",
// 			}),
// 		),
// 		Effect.tap(() =>
// 			Effect.sync(() => {
// 				res.locals.user = "authenticated-user";
// 			}),
// 		),
// 	);

// 	Effect.runPromiseExit(program).then((exit) => {
// 		if (exit._tag === "Failure") {
// 			res.status(getHTTPStatus("BAD_REQUEST")).json(exit.cause);
// 		} else {
// 			next();
// 		}
// 	});
// };

// const MiddlewareCheckUser2: TypedMiddleware<MyInput, { user: string }> = (
// 	_req,
// 	res,
// 	next,
// ) => {
// 	if (res.locals.user !== "authenticated-user") {
// 		res.status(422).json({
// 			status: "BAD_REQUEST",
// 			message: "User not authenticated",
// 			error: "TESTA",
// 		} satisfies ServiceErrorResponse);
// 		return;
// 	}
// 	next();
// };

// const myControllerConfig: ControllerConfig<
// 	keyof MyInput,
// 	Error,
// 	{ user: string },
// 	[typeof DatabaseLive | typeof LoggerLive]
// > = {
// 	service: myService,
// 	requestKeys: ["body", "locals"],
// 	middlewares: asRequestHandler([MiddlewareCheckUser, MiddlewareCheckUser2]),
// 	providers: [DatabaseLive || LoggerLive],
// 	errorHandler: (e) => ({
// 		status: "CONFLICT",
// 		message: "An error occurred",
// 		error: e.message,
// 	}),
// };

// export const myController: RequestHandler[] =
// 	genericController(myControllerConfig);
