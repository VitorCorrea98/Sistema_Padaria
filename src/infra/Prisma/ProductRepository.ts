import { Context, Effect, Layer } from "effect";
import { DatabaseError } from "../../core/Errors";
import type { TProductRecord } from "../../core/Product/domain";
import type { TProductRepository } from "../../core/Product/repository";
import { PrismaClientTag } from ".";

export const ProductRepo =
	Context.GenericTag<TProductRepository<TProductRecord>>("ProductRepo");

export const ProductRepoLive = Layer.effect(
	ProductRepo,
	Effect.gen(function* () {
		const prisma = yield* PrismaClientTag;

		const findById = (id: string) =>
			Effect.tryPromise({
				try: () => prisma.product.findUnique({ where: { id: Number(id) } }),
				catch: (error) =>
					DatabaseError({
						message: "Error when finding user by ID",
						status: "INTERNAL_SERVER_ERROR",
						cause: error,
					}),
			});

		const findAll = () =>
			Effect.tryPromise({
				try: () => prisma.product.findMany(),
				catch: (error) =>
					DatabaseError({
						message: "Error when finding all users",
						status: "INTERNAL_SERVER_ERROR",
						cause: error,
					}),
			});

		const findByName = (name: string) =>
			Effect.tryPromise({
				try: () =>
					prisma.product.findUnique({
						where: { name },
					}),
				catch: (error) =>
					DatabaseError({
						message: "Error when finding user by name",
						status: "INTERNAL_SERVER_ERROR",
						cause: error,
					}),
			});

		return { findAll, findById, findByName };
	}),
);
