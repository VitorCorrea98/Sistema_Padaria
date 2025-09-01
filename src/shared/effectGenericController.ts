import { Context, Effect, Layer } from "effect";
import type { NextFunction, Request, RequestHandler, Response } from "express";

// ---------------------------
// HTTP Status
// ---------------------------
const HTTPGoodStatus = { OK: 200, CREATED: 201 } as const;
const HTTPBadStatus = { BAD_REQUEST: 400, NOT_FOUND: 404 } as const;
const HTTPServerErrorStatus = { INTERNAL_SERVER_ERROR: 500 } as const;

export const HTTPStatusMap = {
	...HTTPGoodStatus,
	...HTTPBadStatus,
	...HTTPServerErrorStatus,
} as const;
export type TStatus = keyof typeof HTTPStatusMap;
export const getHTTPStatus = (status: TStatus) => HTTPStatusMap[status];

// ---------------------------
// Responses
// ---------------------------
export type ServiceSuccessResponse<T = unknown> = {
	status: keyof typeof HTTPGoodStatus;
	message: string;
	data?: T;
};
export type ServiceErrorResponse<T = unknown> = {
	status: keyof typeof HTTPBadStatus | keyof typeof HTTPServerErrorStatus;
	message: string;
	error: T;
};
export type ServiceResponse<Good = unknown, Bad = unknown> =
	| ServiceSuccessResponse<Good>
	| ServiceErrorResponse<Bad>;

// ---------------------------
// Request helpers
// ---------------------------
export type TAllowedRequestKeys =
	| "body"
	| "params"
	| "query"
	| "headers"
	| "locals";

export type TExtractedRequest<T extends TAllowedRequestKeys> = {
	[K in T]: K extends "locals"
		? Record<string, unknown>
		: K extends keyof Request
			? Request[K]
			: never;
};
export const getRequestObjectKeys = <T extends TAllowedRequestKeys>(
	keys: T[],
	req: Request,
	res: Response,
): TExtractedRequest<T> => {
	const result = {} as TExtractedRequest<T>;
	for (const key of keys)
		result[key] = key === "locals" ? res.locals : req[key as keyof Request];
	return result;
};

// ---------------------------
// Generic Controller
// ---------------------------
export type ServiceFunction<TInput, TResponse, TError, Ctx> = (
	input: TInput,
) => Effect.Effect<TResponse, TError, Ctx>;

export type ControllerConfig<
	T extends TAllowedRequestKeys,
	R extends TExtractedRequest<T>,
	S = ServiceSuccessResponse,
	E = ServiceErrorResponse,
	Ctx = unknown,
> = {
	service: ServiceFunction<R, S, E, Ctx>;
	requestKeys: T[];
	middlewares?: RequestHandler[];
	transform?: (program: Effect.Effect<S, E, Ctx>) => Effect.Effect<S, E, never>;
};

export const genericController = <
	T extends TAllowedRequestKeys,
	R extends TExtractedRequest<T>,
	S extends ServiceSuccessResponse,
	E extends ServiceErrorResponse,
	Ctx,
>(
	config: ControllerConfig<T, R, S, E, Ctx>,
): RequestHandler[] => [
	...(config.middlewares ?? []),
	(req: Request, res: Response, next: NextFunction) => {
		const input = getRequestObjectKeys(config.requestKeys, req, res) as R;

		const program = config.service(input);
		const finalProgram = config.transform
			? config.transform(program)
			: (program as Effect.Effect<S, E, never>);

		Effect.runPromiseExit(finalProgram).then((exit) => {
			if (exit._tag === "Success")
				res.status(getHTTPStatus(exit.value.status)).json(exit.value);
			else next(exit.cause);
		});
	},
];

// ---------------------------
// User Repository (Interface)
// ---------------------------
export interface IUserRepo {
	findById(id: string): Promise<{ id: string; name: string } | null>;
}

// ---------------------------
// User Service HOFs
// ---------------------------
export const makeUserService = (repo: IUserRepo) => ({
	findById: (id: string) =>
		Effect.gen(function* ($) {
			const user = yield* Effect.tryPromise({
				try: () => repo.findById(id),
				catch: (err) => new Error(`Failed to fetch user: ${err}`),
			});
			if (!user)
				return {
					status: "NOT_FOUND",
					message: "User not found",
					error: { code: "USER_NOT_FOUND" },
				};
			return { status: "OK", message: "User found", data: user };
		}),
});

const UserRepo = Context.GenericTag<IUserRepo>("UserRepo");

export const UserRepoLive = Layer.effect(
	UserRepo,
	Effect.try({
		try: () => ({
			findById: async (id: string) =>
				id === "1" ? { id: "1", name: "Alice" } : null,
		}),
		catch: (err) => {
			console.error(err);
			throw new Error(`Failed to create UserRepo: ${err}`);
		},
	}),
);

// ---------------------------
// Controller
// ---------------------------
const userService = makeUserService({
	findById: async (id) => (id === "1" ? { id: "1", name: "Alice" } : null),
});

export const getUserController = genericController({
	service: ({ params }) => userService.findById(params.id),
	requestKeys: ["params"],
	transform: (program) => program.pipe(Effect.provide(UserRepoLive)),
}) as RequestHandler[];
