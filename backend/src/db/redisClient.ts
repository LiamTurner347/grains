import { createClient } from "redis";
import { CacheDataSchema } from "../types/types";
import { GetBestDishesResponse, BestDishes } from "../types/types";

const client = createClient();

export const connectToRedis = async () => {
  try {
    if (!client.isOpen) {
      await client.connect();
      console.log("Connected to Redis");
    } else {
      console.log("Redis previously connected");
    }
  } catch (err) {
    console.error("Failed to connect to Redis", err);
  }
};

client.on("error", (err) => console.error("Redis Client Error", err));

export const getCachedData = async (name: string) => {
  const cacheCheck = await client.hGetAll(name);
  return CacheDataSchema.safeParse(cacheCheck);
};

export const checkCacheAndRespond = async (
  name: string,
  res: GetBestDishesResponse
): Promise<boolean> => {
  const cachedData = await getCachedData(name);
  console.log("cacheCheck", cachedData);

  if (cachedData.success) {
    const cachedBestDishes: BestDishes = JSON.parse(cachedData.data.bestDishes);
    res.json({
      restaurant: cachedData.data.restaurant,
      bestDishes: cachedBestDishes,
    });
    return true; // Cache hit
  }
  return false; // Cache miss
};

export const setCachedData = async (
  name: string,
  data: { restaurant: string; bestDishes: string }
) => {
  await client.hSet(name, data);
};

process.on("SIGINT", async () => {
  console.log("Redis connection closed");
  await client.quit();
  process.exit(0);
});
