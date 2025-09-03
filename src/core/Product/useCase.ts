import { Context, Effect, Layer } from "effect";
import { ProductRepo } from "../../infra/Prisma/ProductRepository";
import type { ServiceSuccessResponse } from "../../shared/serviceResponse";
import { BadRequestError } from "../Errors";
import type { IProduct } from "./domain";
import type { TProductService } from "./service";

export const ProductUseCaseContext = Context.GenericTag<
	TProductService<IProduct>
>("ProductUseCaseContext");

export const ProductUseCaseLive = Layer.effect(
	ProductUseCaseContext,
	Effect.gen(function* () {
		const productORM = yield* ProductRepo;

		const getAll = () =>
			productORM.findAll().pipe(
				Effect.map(
					(products) =>
						({
							status: "OK",
							message: "Users found",
							data: products,
						}) as ServiceSuccessResponse<IProduct[]>,
				),
				Effect.mapError((error) =>
					BadRequestError({
						status: "BAD_REQUEST",
						message: "Error when finding users",
						cause: error,
					}),
				),
			);

		const getById = (id: string) =>
			productORM.findById(id).pipe(
				Effect.map(
					(product) =>
						({
							status: "OK",
							message: "User found",
							data: product,
						}) as ServiceSuccessResponse<IProduct>,
				),
				Effect.mapError((error) =>
					BadRequestError({
						status: "BAD_REQUEST",
						message: "Error when finding user",
						cause: error,
					}),
				),
			);

		const getByName = (name: string) =>
			productORM.findByName(name).pipe(
				Effect.map(
					(product) =>
						({
							status: "OK",
							message: "User found",
							data: product,
						}) as ServiceSuccessResponse<IProduct>,
				),
				Effect.mapError((error) =>
					BadRequestError({
						status: "BAD_REQUEST",
						message: "Error when finding user",
						cause: error,
					}),
				),
			);

		return { getAll, getById, getByName };
	}),
);
