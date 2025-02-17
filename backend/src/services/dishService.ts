import { generateBestDishes } from "../api/openAIClient";
import { setCachedData } from "../db/redisClient";

export const getBestDishesForRestaurant = async (
  name: string,
  context: string
) => {
  const bestDishes = await generateBestDishes(name, context);
  console.log("Best dishes generated");
  await setCachedData(name, {
    restaurant: name,
    bestDishes: JSON.stringify(bestDishes),
  });
  console.log("Best dishes cached");

  return { restaurant: name, bestDishes };
};
