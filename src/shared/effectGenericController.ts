import { Cause, Effect, Exit, type Layer, Option } from "effect";
import type { RequestHandler } from "express";
import { getHTTPStatus } from "./httpStatus";
import {
	getRequestObjectKeys,
	isHttpError,
	type ServiceFunction,
	type ServiceSuccessResponse,
	type TAllowedRequestKeys,
	type TExtractedRequest,
} from "./serviceResponse";

export const controllerFactory =
	<TBaseContext>(baseLayer: Layer.Layer<TBaseContext, never, never>) =>
	<
		TInput extends TAllowedRequestKeys,
		TRequest extends TExtractedRequest<TInput>,
		TSuccess,
		TError,
		TContext,
	>(
		service: ServiceFunction<TRequest, TSuccess, TError, TContext>,
		requestKeys: TInput[],
		middlewares: RequestHandler[] = [],
	): RequestHandler[] => {
		const handler: RequestHandler = async (req, res, next) => {
			const input = getRequestObjectKeys(requestKeys, req, res) as TRequest;

			const program = service(input);

			const finalProgram = Effect.provide(program, baseLayer) as Effect.Effect<
				ServiceSuccessResponse<TSuccess>,
				TError,
				never
			>;

			Effect.runPromiseExit(finalProgram).then((exit) => {
				if (Exit.isSuccess(exit)) {
					const response = exit.value;
					res.status(getHTTPStatus(response.status)).json(response);
				} else {
					const failureOption = Cause.failureOption(exit.cause);
					if (Option.isSome(failureOption)) {
						const httpError = failureOption.value;
						if (isHttpError(httpError)) {
							res.status(getHTTPStatus(httpError.status)).json(httpError);
						} else {
							console.error("Unhandled error:", httpError);
							res.status(getHTTPStatus("INTERNAL_SERVER_ERROR")).json({
								message: "An unexpected error occurred",
							});
						}
					} else {
						console.error("Unhandled Error:", Cause.pretty(exit.cause));
						next(exit.cause);
					}
				}
			});
		};

		return [...middlewares, handler];
	};
