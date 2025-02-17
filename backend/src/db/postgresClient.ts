import * as dotenv from "dotenv";
import { Pool } from "pg";
import { Embeddings, SearchResult } from "../types/types";
import { generateSingleEmbedding } from "../api/openAIClient";

dotenv.config();

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: "restaurant_reviews",
});

export const getRestaurantData = async (
  name: string,
  placeID: string
): Promise<number | null> => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT id FROM restaurants WHERE name = $1 AND place_id = $2
    `;
    const result = await client.query(query, [name, placeID]);
    return result.rows[0]?.id || null;
  } finally {
    client.release();
  }
};

export const storeRestaurantData = async (
  name: string,
  placeID: string
): Promise<number> => {
  const client = await pool.connect();
  try {
    await client.query(
      "INSERT INTO restaurants (name, place_id) VALUES ($1, $2) ON CONFLICT (name, place_id) DO NOTHING",
      [name, placeID]
    );
    const restaurantRow = await client.query(
      "SELECT id FROM restaurants WHERE name = $1",
      [name]
    );
    const restaurantId: number = parseInt(restaurantRow.rows[0].id, 10);
    return restaurantId;
  } catch (error) {
    console.error("Error adding info to database:", error);
    throw error;
  } finally {
    client.release();
  }
};

export const storeReviewEmbeddings = async (
  embeddings: Embeddings[],
  restaurantId: number
): Promise<void> => {
  const client = await pool.connect();
  try {
    const insertQueries = embeddings.map(({ review, embedding }) =>
      client.query(
        "INSERT INTO reviews (restaurant_id, review, embedding) VALUES ($1, $2, $3)",
        [restaurantId, review, embedding]
      )
    );

    await Promise.all(insertQueries);
    console.log("All embeddings stored!");
  } catch (err) {
    console.error("Error processing reviews:", err);
  } finally {
    client.release();
  }
};

export const selectRelevantReviews = async (
  restaurantName: string,
  restaurantID: number,
  limit: number
): Promise<SearchResult[]> => {
  const client = await pool.connect();
  try {
    if (!restaurantID) {
      const restaurantIDQuery = await client.query(
        "SELECT id FROM restaurants WHERE name = $1",
        [restaurantName]
      );
      restaurantID = restaurantIDQuery.rows[0]?.id;
    }

    const prompts = [
      "The food at this restaurant was outstanding! The [dish name] was cooked to perfection...",
      "I highly recommend the [dish name]! It had an incredible depth of flavor...",
      "If you're visiting, don’t miss the [dish name]. The sauce was rich, and the seasoning was just right!",
    ];

    // Generate embeddings for all prompts and compute an average
    const embeddings = await Promise.all(prompts.map(generateSingleEmbedding));
    const avgEmbedding = embeddings[0].map(
      (_, i) =>
        embeddings.reduce((sum, emb) => sum + emb[i], 0) / embeddings.length
    );

    const result = await client.query<SearchResult>(
      `SELECT 
              reviews.review,
              1 - (embedding <=> $1::vector) as similarity
           FROM reviews
           WHERE restaurant_id = $2
           ORDER BY similarity DESC
           LIMIT $3`,
      [`[${avgEmbedding}]`, restaurantID, limit]
    );
    console.log("Similar reviews pulled");
    return result.rows;
  } catch (error) {
    console.error("Error searching activities:", error);
    throw error;
  } finally {
    client.release();
  }
};

process.on("SIGINT", async () => {
  await pool.end();
  console.log("Closing database connection pool...");
  process.exit(0);
});
