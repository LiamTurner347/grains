import { z } from "zod";
import { Request, Response } from "express";

export interface SearchResult {
  review: string;
  similarity: number;
}

export interface Embeddings {
  review: string;
  embedding: string;
}

export const DishSchema = z.object({
  name: z.string().describe("The name of the dish / meal"),
  description: z
    .string()
    .describe(
      "Description of the dish / meal including a summary of its best features and what the reviewers have been saying about it"
    ),
});

export type Dish = z.infer<typeof DishSchema>;

export const BestDishesSchema = z.object({
  bestDishes: z.array(DishSchema),
});

export type BestDishes = z.infer<typeof BestDishesSchema>;

export type GetBestDishesRequest = Request<{ name: string; id: string }>;
export type GetBestDishesResponse = Response<{
  restaurant: string;
  bestDishes: BestDishes;
}>;

export const CacheDataSchema = z.object({
  restaurant: z.string(),
  bestDishes: z.string(), // Serialized JSON
});

export type CacheData = z.infer<typeof CacheDataSchema>;
