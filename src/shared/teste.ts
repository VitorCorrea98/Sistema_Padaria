import * as Platform from "@effect/platform-node";
import { pipe } from "effect";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
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

export type TExtractedRequest<T extends TAllowedRequestKeys> = {
	[K in T]: K extends "body"
		? unknown
		: K extends "params"
			? Record<string, string | undefined>
			: K extends "query"
				? Record<string, string | Array<string> | undefined>
				: K extends "headers"
					? Record<string, string | string[] | undefined>
					: Record<string, unknown>;
};

export const getRequestObjectKeys = <T extends TAllowedRequestKeys>(
	keys: T[],
	req: Request,
	res: Response,
): TExtractedRequest<T> => {
	const result = {} as TExtractedRequest<T>;
	for (const key of keys) {
		result[key] = key === "locals" ? res.locals : req[key as keyof Request];
	}
	return result;
};

export type ControllerConfig<T extends TAllowedRequestKeys, E> = {
	service: (input: TExtractedRequest<T>) => Effect.Effect<ServiceResponse, E>;
	requestKeys: T[];
	middlewares: RequestHandler[];
	providers: [Layer.Layer<unknown, never>];
	errorHandler?: (e: E) => ServiceErrorResponse; // Optional for custom error mapping
};

export const genericController = <T extends TAllowedRequestKeys, E>(
	config: ControllerConfig<T, E>,
): RequestHandler[] => [
	...config.middlewares,
	(req: Request, res: Response, next: NextFunction) => {
		const input = getRequestObjectKeys(config.requestKeys, req, res);

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
		);

		Effect.runPromise(program)
			.then((response) => {
				res.status(getHTTPStatus(response.status)).json(response);
			})
			.catch((err) => next(err));
	},
];

interface MyInput {
	body: { name: string };
	locals: { user: string };
}
const myService = (input: MyInput) =>
	Effect.gen(function* () {
		return { status: 200, data: { message: "Success" } } as ServiceResponse;
	});
