import { Data, type Effect } from "effect";
import type { Request, Response } from "express";
import type { HTTPGoodStatus, THttpErrorKeys } from "./httpStatus";

export type ServiceSuccessResponse<T = unknown> = {
	status: keyof typeof HTTPGoodStatus;
	message: string;
	data?: T;
};

export type ServiceErrorResponse<T = unknown> = {
	status: THttpErrorKeys;
	message: string;
	error: T;
};

type ErrorStatusMap = {
	ValidationError: "BAD_REQUEST";
	DatabaseError: "INTERNAL_SERVER_ERROR";
	UnauthorizedError: "UNAUTHORIZED";
	ForbiddenError: "FORBIDDEN";
	NotFoundError: "NOT_FOUND";
	ConflictError: "CONFLICT";
};

type AllErrorsTags = keyof ErrorStatusMap;

export interface HttpError<T extends AllErrorsTags = AllErrorsTags> {
	readonly _tag: T;
	readonly status: ErrorStatusMap[T];
	readonly message: string;
	readonly cause?: unknown;
}

export const ErrorFactory = <T extends AllErrorsTags>(tag: T) =>
	Data.tagged<HttpError<T>>(tag);

export const isHttpError = (u: unknown): u is HttpError => {
	return (
		u !== null &&
		typeof u === "object" &&
		"_tag" in u &&
		typeof (u as HttpError)._tag === "string" &&
		"status" in u &&
		typeof (u as HttpError).status === "string" &&
		"message" in u &&
		typeof (u as HttpError).message === "string"
	);
};

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
	for (const key of keys) {
		result[key] = key === "locals" ? res.locals : req[key as keyof Request];
	}
	return result;
};

export type ServiceFunction<TInput, TSuccess, TError, TContext> = (
	input: TInput,
) => Effect.Effect<ServiceSuccessResponse<TSuccess>, TError, TContext>;
