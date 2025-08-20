import { Effect } from "effect";
import express from "express";
import { LoadEnv } from "./core/config/env";
import { myController } from "./shared/genericController";
import { ConsoleLogger } from "./shared/logger";

const app = express();
app.use(express.json());

app.post("/orders", myController);

app.get("/health", async (_, res) => {
	res.json({ status: "ok" });
});

const MainLive = Effect.gen(function* (_) {
	const logger = ConsoleLogger;
	const env = yield* LoadEnv;

	yield* logger.info(
		`🚀 Server ${env.NODE_ENV} running at http://localhost:${env.PORT}`,
	);

	app.listen(env.PORT);
});

Effect.runPromise(MainLive).catch(console.error);
