import { Context, Data, Effect, Layer } from "effect";
import type { DefaultInfraInterface } from "../types";

export type IProductId = string;
export type IQuantity = number;

export interface IProduct {
	name: string;
	price: number;
}

export type ProductRecord = DefaultInfraInterface & IProduct;

export type TGenericError<T> = {
	readonly _tag: T;
	readonly message: string;
};

export const InventoryError =
	Data.tagged<TGenericError<"InventoryError">>("InventoryError");
export const OrderError =
	Data.tagged<TGenericError<"OrderError">>("OrderError");

export type BakeryError = typeof InventoryError | typeof OrderError;

export interface InventoryRepo {
	getStock: (
		productId: IProductId,
	) => Effect.Effect<number, BakeryError, never>;
	updateStock: (
		productId: IProductId,
		delta: IQuantity,
	) => Effect.Effect<void, BakeryError, never>;
}

export const InventoryRepoTag =
	Context.GenericTag<InventoryRepo>("InventoryRepo");

export interface OrderRepo {
	saveOrder: (order: {
		id: string;
		item: { productId: IProductId; qty: IQuantity };
	}) => Effect.Effect<string, BakeryError, never>;
}

export const OrderRepoTag = Context.GenericTag<OrderRepo>("OrderRepo");

export const validateStock = (productId: IProductId, qty: IQuantity) =>
	Effect.gen(function* () {
		const repo = yield* InventoryRepoTag;
		const stock = yield* repo.getStock(productId);
		if (stock < qty)
			return yield* Effect.fail(
				InventoryError({ message: `Insufficient stock for ${productId}` }),
			);
		return stock;
	});

export const placeOrder = (order: {
	item: { productId: IProductId; qty: IQuantity };
}) =>
	Effect.gen(function* () {
		// Parallel validation using Effect.all
		// yield* Effect.all(
		// 	order.items.map((item) => validateStock(item.productId, item.qty)),
		// 	{ concurrency: "unbounded" },
		// );

		// Update stocks sequentially
		const repo = yield* InventoryRepoTag;
		yield* repo.updateStock(order.item.productId, -order.item.qty);

		const orderRepo = yield* OrderRepoTag;
		const orderId = yield* orderRepo.saveOrder({
			id: crypto.randomUUID(),
			...order,
		});
		return orderId;
	});

// In-memory adapter
export const inventoryImpl: InventoryRepo = {
	getStock: (_id) => Effect.succeed(10), // Mock
	updateStock: (id, delta) =>
		Effect.sync(() => console.log(`Updated ${id} by ${delta}`)),
};
export const InventoryLayer = Layer.succeed(InventoryRepoTag, inventoryImpl);

export const orderImpl: OrderRepo = {
	saveOrder: () => Effect.succeed("Saved successfully"),
};

export const OrderLayer = Layer.succeed(OrderRepoTag, orderImpl);
