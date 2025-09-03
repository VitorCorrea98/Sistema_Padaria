import { ErrorFactory, type HttpError } from "../../shared/serviceResponse";

export type TDatabaseError = HttpError<"DatabaseError">;
export const DatabaseError = ErrorFactory("DatabaseError");

export type TNotFoundError = HttpError<"NotFoundError">;
export const NotFoundError = ErrorFactory("NotFoundError");

export type TBadRequestError = HttpError<"BadRequestError">;
export const BadRequestError = ErrorFactory("BadRequestError");
