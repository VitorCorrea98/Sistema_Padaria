import { Data } from "effect";
import { ErrorFactory, type HttpError } from "../../shared/serviceResponse";

export type TDatabaseError = HttpError<"DatabaseError">;
export const DatabaseError = ErrorFactory("DatabaseError");

export const NotFoundError = ErrorFactory("NotFoundError");
export type TNotFoundError = typeof NotFoundError;
