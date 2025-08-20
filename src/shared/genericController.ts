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

export const HTTPStatusMap = {
	...HTTPGoodStatus,
	...HTTPBadStatus,
	...HTTPServerErrorStatus,
} as const;

export type TGoodStatus = keyof typeof HTTPGoodStatus;

export type TBadStatus = keyof typeof HTTPBadStatus;

export type TServerStatus = keyof typeof HTTPServerErrorStatus;

export type HTTPResponseStatus = keyof typeof HTTPStatusMap;

export const getHTTPStatus = (status: HTTPResponseStatus) =>
	HTTPStatusMap[status];

export type ServiceSuccessResponse<T = unknown> = {
	status: TGoodStatus;
	message: string;
	data?: T;
};

export type ServiceErrorResponse<T = unknown> = {
	status: TBadStatus | TServerStatus;
	message: string;
	error: T;
};

export type ServiceResponse = ServiceSuccessResponse | ServiceErrorResponse;

export type ServiceFunction<TInput, TResponse> = (
	input: TInput,
) => Promise<TResponse>;

export type TAllowedRequestKeys =
	| "body"
	| "params"
	| "query"
	| "headers"
	| "locals";

export type TExtractedRequest<
	T extends TAllowedRequestKeys,
	TLocals = Record<string, unknown>,
> = {
	[K in T]: K extends "locals"
		? TLocals
		: K extends keyof Request
			? Request[K]
			: never;
};

export const getRequestObjectKeys = <
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

export type ControllerConfig<
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

export const genericController = <
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

type MyInput = {
	body: { name: string };
	locals: { user: string };
};

const myService = (input: MyInput) =>
	Effect.succeed({
		status: "OK",
		message: "Success",
		data: {
			name: input.body.name,
			user: input.locals.user,
		},
	} as ServiceSuccessResponse);

const myControllerConfig: ControllerConfig<
	keyof MyInput,
	Error,
	{ user: string }
> = {
	service: myService,
	requestKeys: ["body", "locals"],
	middlewares: [],
	providers: undefined,
	errorHandler: (e) => ({
		status: "CONFLICT",
		message: "An error occurred",
		error: e.message,
	}),
};

export const myController: RequestHandler[] =
	genericController(myControllerConfig);
