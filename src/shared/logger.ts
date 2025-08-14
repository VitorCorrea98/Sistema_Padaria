import { Effect } from "effect";

export interface Logger {
	info: (msg: string) => Effect.Effect<void, never, never>;
	error: (msg: string) => Effect.Effect<void, never, never>;
}

export const ConsoleLogger: Logger = {
	info: (msg) => Effect.sync(() => console.log("[INFO]", msg)),
	error: (msg) => Effect.sync(() => console.error("[ERROR]", msg)),
};
