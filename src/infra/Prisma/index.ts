import { Context, Effect, Layer } from "effect";
import { PrismaClient } from "../../../prisma/generated/prisma";

export const PrismaClientTag = Context.GenericTag<PrismaClient>(
	"@services/PrismaClientTag",
);

export const PrismaClientLive = Layer.scoped(
	PrismaClientTag,
	Effect.acquireRelease(
		Effect.sync(() => new PrismaClient()).pipe(
			Effect.tap((prisma) => Effect.promise(() => prisma.$connect())),
		),
		(prisma) => Effect.promise(() => prisma.$disconnect()),
	),
);
