import * as dotenv from "dotenv";
import { GetBestDishesRequest, GetBestDishesResponse } from "../types/types";
import { connectToRedis, checkCacheAndRespond } from "../db/redisClient";
import { fetchAndProcessReviews } from "../services/reviewService";
import { getBestDishesForRestaurant } from "../services/dishService";

dotenv.config();

// Main function
export const getBestDishes = async (
  req: GetBestDishesRequest,
  res: GetBestDishesResponse
): Promise<void> => {
  const name = req.params.name;
  const placeID = req.params.id;

  await connectToRedis();
  const isCacheHit = await checkCacheAndRespond(name, res);
  if (isCacheHit) return; // Exit early if cache hit

  const context = await fetchAndProcessReviews(name, placeID);
  const result = await getBestDishesForRestaurant(name, context);
  res.json(result);
};

export default getBestDishes;
