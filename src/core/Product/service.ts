import type { Effect } from "effect";
import type { ServiceSuccessResponse } from "../../shared/serviceResponse";
import type { TBadRequestError } from "../Errors";

export type TProductService<T> = {
	getAll: () => Effect.Effect<ServiceSuccessResponse<T[]>, TBadRequestError>;
	getById: (
		id: string,
	) => Effect.Effect<ServiceSuccessResponse<T>, TBadRequestError>;
	getByName: (
		name: string,
	) => Effect.Effect<ServiceSuccessResponse<T>, TBadRequestError>;
};
