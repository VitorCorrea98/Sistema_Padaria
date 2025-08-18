// core/config/env.ts
import { Effect, Schema } from "effect";

const EnvSchema = Schema.Struct({
	NODE_ENV: Schema.Literal("DEV", "PROD"),
	PORT: Schema.NumberFromString, // Aceita string e converte para número
	DATABASE_URL: Schema.String,
});

export interface IEnv extends Schema.Schema.Type<typeof EnvSchema> {}

export const LoadEnv = Effect.sync(() => process.env).pipe(
	Effect.flatMap(Schema.decodeUnknown(EnvSchema)), // Valida e tipa
);
