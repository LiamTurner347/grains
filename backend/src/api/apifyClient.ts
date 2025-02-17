import { ApifyClient } from "apify-client";
import * as dotenv from "dotenv";
dotenv.config();

export const getReviews = async (placeID: string): Promise<string[]> => {
  const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
  });

  const input = {
    placeIds: [`${placeID}`],
    maxReviews: 150,
    reviewsSort: "newest",
    reviewsStartDate: "2023-01-01",
    language: "en",
    personalData: false,
  };

  const actorClient = client.actor("compass/Google-Maps-Reviews-Scraper");
  const run = await actorClient.call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const reviews = (items ?? [])
    .map((review) => review.text)
    .filter((text): text is string => typeof text === "string");

  return reviews;
};
