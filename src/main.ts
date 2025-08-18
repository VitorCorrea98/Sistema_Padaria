import { Effect } from "effect";
import express from "express";
import { LoadEnv } from "./core/config/env";
import { config } from "./env";
import { ConsoleLogger } from "./shared/logger";

const app = express();
app.use(express.json());

app.get("/health", (_, res) => {
	res.json({ status: "ok" });
});

const MainLive = Effect.gen(function* (_) {
	const logger = ConsoleLogger;
	const env = yield* LoadEnv;

	yield* logger.info(
		`🚀 Server ${env.NODE_ENV} running at http://localhost:${config.PORT}`,
	);

	app.listen(config.PORT);
});

Effect.runPromise(MainLive).catch(console.error);
