import type { DefaultInfraInterface } from "../../types";

export interface IProduct {
	name: string;
	price: number;
}

export type TProductRecord = DefaultInfraInterface & IProduct;
