import type { Effect } from "effect";
import type { TDatabaseError } from "../Errors";

export type TProductRead<T> = {
	findAll: () => Effect.Effect<T[], TDatabaseError>;
	findById: (id: string) => Effect.Effect<T | null, TDatabaseError>;
	findByName: (name: string) => Effect.Effect<T | null, TDatabaseError>;
};

export type TProductRepository<T> = TProductRead<T>;
