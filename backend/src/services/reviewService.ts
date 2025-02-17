import {
  getRestaurantData,
  storeRestaurantData,
  storeReviewEmbeddings,
  selectRelevantReviews,
} from "../db/postgresClient";
import { getReviews } from "../api/apifyClient";
import { generateReviewEmbeddings } from "../api/openAIClient";

export const fetchAndProcessReviews = async (name: string, placeID: string) => {
  let restaurantID = await getRestaurantData(name, placeID);
  if (!restaurantID) {
    const reviews = await getReviews(placeID);
    restaurantID = await storeRestaurantData(name, placeID);
    const embeddings = await generateReviewEmbeddings(name, placeID, reviews);
    await storeReviewEmbeddings(embeddings, restaurantID);
  }
  const contextReviews = await selectRelevantReviews(name, restaurantID, 50);
  console.log("Context reviews received");
  const context = contextReviews
    .map(
      (result) =>
        `- ${result.review} (Similarity: ${result.similarity.toFixed(2)})`
    )
    .join("\n");
  console.log("Context generated");
  return context;
};
