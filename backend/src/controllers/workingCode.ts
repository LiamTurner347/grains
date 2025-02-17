import * as dotenv from "dotenv";
import { Pool } from "pg";
import { ApifyClient } from "apify-client";
import { OpenAI } from "openai";
import { SearchResult } from "../types/types";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "redis";
import {
  BestDishes,
  BestDishesSchema,
  GetBestDishesRequest,
  GetBestDishesResponse,
  CacheDataSchema,
  Embeddings,
} from "../types/types";

dotenv.config();

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: "restaurant_reviews",
});

const client = createClient();
client.on("error", (err) => console.error("Redis Client Error", err));
(async () => {
  try {
    await client.connect();
    console.log("Connected to Redis");
  } catch (err) {
    console.error("Failed to connect to Redis", err);
  }
})();

// Main function
const getBestDishes = async (
  req: GetBestDishesRequest,
  res: GetBestDishesResponse
): Promise<void> => {
  const name = req.params.name;
  const placeID = req.params.id;
  const cacheCheck = await client.hGetAll(name);
  const parsedCacheCheck = CacheDataSchema.safeParse(cacheCheck);
  console.log("cacheCheck", cacheCheck);

  // Validate cacheCheck
  if (parsedCacheCheck.success) {
    const cachedBestDishes: BestDishes = JSON.parse(
      parsedCacheCheck.data.bestDishes
    );
    // If cacheCheck has the required properties, return it
    res.json({
      restaurant: parsedCacheCheck.data.restaurant,
      bestDishes: cachedBestDishes,
    });
    return;
  }

  // Check whether a restaurant with the name and id exists
  let restaurantID = await getRestaurantData(name, placeID);
  console.log(restaurantID);

  let reviews: string[] = [];
  if (!restaurantID) {
    // Get the reviews from Apify API (TO TRY DIFFERENT API FOR SPEED)
    reviews = await getReviews(placeID);
    restaurantID = await storeData(name, placeID, reviews);
    // Vectorise the reviews we have just fetched
    const embeddings = await generateReviewEmbeddings(name, placeID, reviews);
    await storeReviewEmbeddings(embeddings, restaurantID);
  }

  const contextReviews = await searchRelevantReviews(name, restaurantID, 50);
  console.log("Context reviews received");
  const context = contextReviews
    .map(
      (result) =>
        `- ${result.review} (Similarity: ${result.similarity.toFixed(2)})`
    )
    .join("\n");
  console.log("Context generated");

  const bestDishesText = await generateBestDishes(name, context);
  console.log(bestDishesText);

  const cacheData = {
    restaurant: name,
    bestDishes: JSON.stringify(bestDishesText), // Serialize bestDishes
  };
  console.log("Cache data to be saved", cacheData);

  await client.hSet(name, cacheData);

  res.json({
    restaurant: name,
    bestDishes: bestDishesText,
  });
};

const getRestaurantData = async (
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

// Consider different API to Apify for speed purposes
const getReviews = async (placeID: string): Promise<string[]> => {
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
  console.log("Reviews fetched from Apify API");
  return reviews;
};

const storeData = async (
  name: string,
  placeID: string,
  reviews: string[]
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

const generateReviewEmbeddings = async (
  name: string,
  placeID: string,
  reviews: string[]
): Promise<Embeddings[]> => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  /*
  const client = await pool.connect();
  /*
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
  */

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: reviews,
    });

    const embeddings = response.data.map((d, index) => ({
      review: reviews[index],
      embedding: JSON.stringify(d.embedding),
    }));
    console.log("All embeddings generated");
    return embeddings;
    /*
    const insertQueries = embeddings.map(({ review, embedding }) =>
      client.query(
        "INSERT INTO reviews (restaurant_id, review, embedding) VALUES ($1, $2, $3)",
        [restaurantId, review, embedding]
      )
    );

    await Promise.all(insertQueries);
    console.log("All embeddings generated and stored!");
    */
  } catch (err) {
    console.error("Batch embedding error:", err);
    throw err;
  }
};

const storeReviewEmbeddings = async (
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

const searchRelevantReviews = async (
  restaurantName: string,
  restaurantID: number,
  limit: number
): Promise<SearchResult[]> => {
  try {
    console.log(restaurantID);

    if (!restaurantID) {
      const restaurantIDQuery = await pool.query(
        "SELECT id FROM restaurants WHERE name = $1",
        [restaurantName]
      );
      restaurantID = restaurantIDQuery.rows[0]?.id;
    }

    console.log(restaurantID);

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

    const result = await pool.query<SearchResult>(
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
  }
};

const generateSingleEmbedding = async (text: string): Promise<number[]> => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
};

const generateBestDishes = async (
  name: string,
  context: string
): Promise<BestDishes> => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `
    You are a renowned food critic writing for a high-end dining magazine.
    Based on the customer reviews, provide a refined and engaging summary of the best dishes at **${name}**.

    **Guidelines:**
    - **Highlight standout dishes**, their **key flavors** and **textures**.
    - **Do not list general dish categories** like "seafood" or "pasta."
    - **Focus on specific dish names** mentioned by multiple reviewers. If a dish is praised a number of times, 
    give it additional precedence. 
    - **Explain why the dishes are exceptional** and loved by customers.
    - **If a dish was part of a "specials menu," mention it.**
    - **Avoid price references**
    - **Avoid returning vague single ingredients** (like "mushrooms" or "egg").

    **Customer Review Insights:**
    ${context}

    **Final Output Format:**
    - **Dish Name:** [E.g., Lobster Ravioli]
    - **Why It's Loved:** [Describe flavors, textures, and presentation]
  `;
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content:
            "You are a renowned food critic known for eloquent and insightful culinary reviews. Your tone should be sophisticated, knowledgeable, and evocative.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      response_format: zodResponseFormat(BestDishesSchema, "data"),
    });

    const parsedBestDishes = completion.choices[0].message.parsed;
    if (parsedBestDishes && Array.isArray(parsedBestDishes.bestDishes)) {
      return parsedBestDishes;
    } else {
      throw new Error("Invalid best dishes format");
    }
  } catch (error) {
    console.error("Error generating best dishes:", error);
    throw new Error(
      "Failed to generate best dishes summary. Please try again."
    );
  }
};

process.on("SIGINT", async () => {
  console.log("Closing database connection pool...");
  await pool.end();
  process.exit(0);
});

export default getBestDishes;

/*
import * as dotenv from "dotenv";
import { Pool } from "pg";
import { ApifyClient } from "apify-client";
import { OpenAI } from "openai";
import { SearchResult } from "../types/types";
import { zodResponseFormat } from "openai/helpers/zod";
import { BestDishesSchema } from "../types/types";
import { createClient } from "redis";

dotenv.config();

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: "restaurant_reviews",
});

const client = createClient();
client.on("error", (err) => console.error("Redis Client Error", err));
(async () => {
  try {
    await client.connect();
    console.log("Connected to Redis");
  } catch (err) {
    console.error("Failed to connect to Redis", err);
  }
})();

// Main function
const getBestDishes = async (
  req: { params: { name: any; id: any } },
  res: { json: (arg0: { restaurant: any; bestDishes: any }) => void }
) => {
  const name = req.params.name;
  const placeID = req.params.id;
  const cacheCheck = await client.hGetAll(name);
  console.log("cacheCheck", cacheCheck);
  // Validate cacheCheck
  if (cacheCheck && cacheCheck.restaurant && cacheCheck.bestDishes) {
    // If cacheCheck has the required properties, return it
    return res.json({
      restaurant: cacheCheck.restaurant,
      bestDishes: JSON.parse(cacheCheck.bestDishes),
    });
  }

  // Check whether a restaurant with the name and id exists
  const restaurantID = await getRestaurantData(name, placeID);
  console.log(restaurantID);

  // const restaurantInDB = await restaurantExists(name, id);
  // Log whether or not restaurant is stored in database
  // console.log(restaurantInDB);

  //
  let reviews;
  if (!restaurantID) {
    // Get the reviews from Apify API (TO TRY DIFFERENT API FOR SPEED)
    reviews = await getReviews(placeID);
    // Vectorise the reviews we have just fetched
    await generateReviewEmbeddings(name, placeID, reviews);
  }

  const contextReviews = await searchRelevantReviews(name, restaurantID, 50);
  console.log("Context reviews received");
  const context = contextReviews
    .map(
      (result) =>
        `- ${result.review} (Similarity: ${result.similarity.toFixed(2)})`
    )
    .join("\n");
  console.log("Context generated");

  const bestDishesText = await generateBestDishes(name, context);
  console.log(bestDishesText);

  const cacheData = {
    restaurant: name,
    bestDishes: JSON.stringify(bestDishesText), // Serialize bestDishes
  };
  console.log("Cache data to be saved", cacheData);

  await client.hSet(name, cacheData);

  res.json({
    restaurant: name,
    bestDishes: bestDishesText,
  });
};

const getRestaurantData = async (name: string, placeID: string) => {
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

// Consider different API to Apify for speed purposes
const getReviews = async (placeID: string): Promise<string[]> => {
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
  console.log("Reviews fetched from Apify API");
  return reviews;
};

const generateReviewEmbeddings = async (
  name: string,
  placeID: string,
  reviews: string[]
) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

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

    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: reviews,
      });

      const embeddings = response.data.map((d, index) => ({
        review: reviews[index],
        embedding: JSON.stringify(d.embedding),
      }));

      const insertQueries = embeddings.map(({ review, embedding }) =>
        client.query(
          "INSERT INTO reviews (restaurant_id, review, embedding) VALUES ($1, $2, $3)",
          [restaurantId, review, embedding]
        )
      );

      await Promise.all(insertQueries);
      console.log("All embeddings generated and stored!");
    } catch (err) {
      console.error("Batch embedding error:", err);
    }
  } catch (err) {
    console.error("Error processing reviews:", err);
  } finally {
    client.release();
  }
};

const searchRelevantReviews = async (
  restaurantName: string,
  restaurantID: number,
  limit: number
): Promise<SearchResult[]> => {
  try {
    console.log(restaurantID);

    if (!restaurantID) {
      const restaurantIDQuery = await pool.query(
        "SELECT id FROM restaurants WHERE name = $1",
        [restaurantName]
      );
      restaurantID = restaurantIDQuery.rows[0]?.id;
    }

    console.log(restaurantID);

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

    const result = await pool.query<SearchResult>(
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
  }
};

const generateSingleEmbedding = async (text: string): Promise<number[]> => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
};

const generateBestDishes = async (name: string, context: string) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `
    You are a renowned food critic writing for a high-end dining magazine.
    Based on the customer reviews, provide a refined and engaging summary of the best dishes at **${name}**.

    **Guidelines:**
    - **Highlight standout dishes**, their **key flavors** and **textures**.
    - **Do not list general dish categories** like "seafood" or "pasta."
    - **Focus on specific dish names** mentioned by multiple reviewers. If a dish is praised a number of times, 
    give it additional precedence. 
    - **Explain why the dishes are exceptional** and loved by customers.
    - **If a dish was part of a "specials menu," mention it.**
    - **Avoid price references**
    - **Avoid returning vague single ingredients** (like "mushrooms" or "egg").

    **Customer Review Insights:**
    ${context}

    **Final Output Format:**
    - **Dish Name:** [E.g., Lobster Ravioli]
    - **Why It's Loved:** [Describe flavors, textures, and presentation]
  `;
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content:
            "You are a renowned food critic known for eloquent and insightful culinary reviews. Your tone should be sophisticated, knowledgeable, and evocative.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      response_format: zodResponseFormat(BestDishesSchema, "data"),
    });

    return completion.choices[0].message.parsed || "No relevant dishes found";
  } catch (error) {
    console.error("Error generating best dishes:", error);
    throw new Error(
      "Failed to generate best dishes summary. Please try again."
    );
  }
};

process.on("SIGINT", async () => {
  console.log("Closing database connection pool...");
  await pool.end();
  process.exit(0);
});

export default getBestDishes;
/*
import * as dotenv from "dotenv";
import { Pool } from "pg";
import { ApifyClient } from "apify-client";
import { OpenAI } from "openai";
import { SearchResult } from "../types/types";
import { zodResponseFormat } from "openai/helpers/zod";
import { BestDishesSchema } from "../types/types";

dotenv.config();

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: "restaurant_reviews",
});

// Main function
const getBestDishes = async (
  req: { params: { name: any; id: any } },
  res: { json: (arg0: { restaurant: any; bestDishes: any }) => void }
) => {
  const name = req.params.name;
  const placeID = req.params.id;

  // Check whether a restaurant with the name and id exists
  const restaurantID = await getRestaurantData(name, placeID);
  console.log(restaurantID);

  // const restaurantInDB = await restaurantExists(name, id);
  // Log whether or not restaurant is stored in database
  // console.log(restaurantInDB);

  //
  let reviews;
  if (!restaurantID) {
    // Get the reviews from Apify API (TO TRY DIFFERENT API FOR SPEED)
    reviews = await getReviews(placeID);
    // Vectorise the reviews we have just fetched
    await generateReviewEmbeddings(name, placeID, reviews);
  }

  const contextReviews = await searchRelevantReviews(name, restaurantID, 25);
  console.log("Context reviews received");
  const context = contextReviews
    .map(
      (result) =>
        `- ${result.review} (Similarity: ${result.similarity.toFixed(2)})`
    )
    .join("\n");
  console.log("Context generated");

  const bestDishesText = await generateBestDishes(name, context);

  res.json({
    restaurant: name,
    bestDishes: bestDishesText,
  });
};

const getRestaurantData = async (name: string, placeID: string) => {
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

/*
const restaurantExists = async (name: string, id: string) => {
  const client = await pool.connect();
  try {
    await client.connect();
    const query =
      "SELECT EXISTS (SELECT 1 FROM restaurants WHERE name = $1 AND place_id = $2)";
    const values = [name, id];
    const result = await client.query(query, values);
    return result.rows[0].exists;
  } catch (err) {
    console.error("Error searching for restaurant in database:", err);
  } finally {
    client.release();
  }
};


const getReviews = async (placeID: string): Promise<string[]> => {
  const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
  });

  const input = {
    placeIds: [`${placeID}`],
    maxReviews: 100,
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
  console.log("Reviews fetched from Apify API");
  return reviews;
};

const generateReviewEmbeddings = async (
  name: string,
  placeID: string,
  reviews: string[]
) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

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

    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: reviews,
      });

      const embeddings = response.data.map((d, index) => ({
        review: reviews[index],
        embedding: JSON.stringify(d.embedding),
      }));

      const insertQueries = embeddings.map(({ review, embedding }) =>
        client.query(
          "INSERT INTO reviews (restaurant_id, review, embedding) VALUES ($1, $2, $3)",
          [restaurantId, review, embedding]
        )
      );

      await Promise.all(insertQueries);
      console.log("All embeddings generated and stored!");
    } catch (err) {
      console.error("Batch embedding error:", err);
    }
  } catch (err) {
    console.error("Error processing reviews:", err);
  } finally {
    client.release();
  }
};

const searchRelevantReviews = async (
  restaurantName: string,
  restaurantID: number,
  limit: number
): Promise<SearchResult[]> => {
  try {
    console.log(restaurantID);

    if (!restaurantID) {
      const restaurantIDQuery = await pool.query(
        "SELECT id FROM restaurants WHERE name = $1",
        [restaurantName]
      );
      restaurantID = restaurantIDQuery.rows[0]?.id;
    }

    console.log(restaurantID);

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

    const result = await pool.query<SearchResult>(
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
  }
};

const generateSingleEmbedding = async (text: string): Promise<number[]> => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
};

const generateBestDishes = async (name: string, context: string) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `
    You are a renowned food critic writing for a high-end dining magazine.
    Based on the customer reviews, provide a refined and engaging summary of the best dishes at **${name}**.

    **Guidelines:**
    - **Highlight standout dishes**, their **key flavors** and **textures**.
    - **Do not list general dish categories** like "seafood" or "pasta."
    - **Focus on specific dish names** mentioned by multiple reviewers. If a dish is praised or positively mentioned a number of times, 
    give it additional weight when ranking dishes. 
    - **Explain why the dishes are exceptional** and loved by customers.
    - **If a dish was part of a "specials menu," mention it.**
    - **Avoid price references**
    - **Avoid returning vague single ingredients** (like "mushrooms" or "egg").

    **Customer Review Insights:**
    ${context}

    **Final Output Format:**
    - **Dish Name:** [E.g., Lobster Ravioli]
    - **Why It's Loved:** [Describe flavors, textures, and presentation]
  `;
  /*
  `Based on the following customer reviews of a restaurant, provide a refined and engaging summary of the
  best dishes to purchase at the restaurant ${name}. Your tone should be sophisticated, knowledgeable, and evocative — akin 
  to a seasoned food journalist writing for a high-end dining publication. Highlight the standout dishes, their key flavors, 
  textures, and what makes them exceptional. Please do not just select ingredients like egg or mushroom. Please do not recommend things
  like a set menu without making reference to the specific dishes within that set menu which make it special. Please do not
  reference the price of dishes. Please do not recommend general categories of dishes like 'seafood dishes' or 'pasta dishes'. 
  Please ensure that the dishes are as specific as possible and you are recommending actual full meals/dishes which might be 
  ordered by a patron of the restaurant and has previously been ordered by reviewers of the restaurant 
  (like eggs benedict or lobster ravioli or steak frites etc). Please give as specific a name for the dish as you can 
  based on the naming used by the reviewers. If a dish was only available as part of a 'specials' menu, please make
  that clear in your response. Assign some weight to the number of times that a particular dish is mentioned favorably and
  return those dishes which are mentioned over and over again earlier in your response. Look for patterns and explain why these dishes 
  are so loved and highly rated by visitors to the restaurant. Use vivid yet refined language to paint a picture of the dining experience, 
  leveraging the information on the dishes which patrons have provided in their reviews. 
  Avoid clichés and instead offer a nuanced appreciation of the cuisine. Here are the customer reviews for context: 
  ${context}
  If you also have any information on the general vibe and ambience in the restaurant, please feel free to add that as 
  additional information for the user.
  Question: Tell me what are the best dishes to buy at the restaurant ${name}. You have the benefit of recent
  reviews for context and I want you to only base your answers on your reviews. If you can't find any good dishes which the
  reviewers enjoyed or thought were delicious, please say so.`;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content:
            "You are a renowned food critic known for eloquent and insightful culinary reviews. Your tone should be sophisticated, knowledgeable, and evocative.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      response_format: zodResponseFormat(BestDishesSchema, "data"),
    });

    return completion.choices[0].message.parsed || "No relevant dishes found";
  } catch (error) {
    console.error("Error generating best dishes:", error);
    throw new Error(
      "Failed to generate best dishes summary. Please try again."
    );
  }
};

process.on("SIGINT", async () => {
  console.log("Closing database connection pool...");
  await pool.end();
  process.exit(0);
});

export default getBestDishes;

import * as dotenv from "dotenv";
import { Client } from "pg";
import { ApifyClient } from "apify-client";
import { OpenAI } from "openai";
import { SearchResult } from "../types/types";
import { zodResponseFormat } from "openai/helpers/zod";
import { BestDishesSchema } from "../types/types";

dotenv.config();

// Main function
const getBestDishes = async (
  req: { params: { name: any; id: any } },
  res: { json: (arg0: { restaurant: any; bestDishes: any }) => void }
) => {
  const name = req.params.name;
  const id = req.params.id;

  // Check whether a restaurant with the name and id exists
  const restaurantInDB = await restaurantExists(name, id);
  // Log whether or not restaurant is stored in database
  console.log(restaurantInDB);

  //
  let reviews;
  if (!restaurantInDB) {
    // Get the reviews from Apify API (TO TRY DIFFERENT API FOR SPEED)
    reviews = await getReviews(id);
    // Vectorise the reviews we have just fetched
    await generateReviewEmbeddings(name, id, reviews);
  }

  const contextReviews = await searchRelevantReviews(name, 50);
  const context = contextReviews
    .map(
      (result) =>
        `- ${result.review} (Similarity: ${result.similarity.toFixed(2)})`
    )
    .join("\n");

  const bestDishesText = await generateBestDishes(name, context);

  res.json({
    restaurant: name,
    bestDishes: bestDishesText,
  });
};

const dbClient = async () => {
  const client = new Client({
    host: "localhost",
    port: 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: "restaurant_reviews",
  });

  return client;
};

const restaurantExists = async (name: string, id: string) => {
  const client = await dbClient();
  try {
    await client.connect();
    const query =
      "SELECT EXISTS (SELECT 1 FROM restaurants WHERE name = $1 AND place_id = $2)";
    const values = [name, id];
    const result = await client.query(query, values);
    return result.rows[0].exists;
  } catch (err) {
    console.error("Error searching for restaurant in database:", err);
  } finally {
    await client.end();
  }
};

const getReviews = async (id: string): Promise<string[]> => {
  const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
  });

  const input = {
    placeIds: [`${id}`],
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
  console.log("Reviews fetched from Apify API");
  return reviews;
};

const generateReviewEmbeddings = async (
  name: string,
  id: string,
  reviews: string[]
) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const client = await dbClient();

  try {
    await client.connect();
    await client.query(
      "INSERT INTO restaurants (name, place_id) VALUES ($1, $2) ON CONFLICT (name, place_id) DO NOTHING",
      [name, id]
    );
    const restaurantRow = await client.query(
      "SELECT id FROM restaurants WHERE name = $1",
      [name]
    );
    const restaurantId: number = parseInt(restaurantRow.rows[0].id, 10);

    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: reviews,
      });

      const embeddings = response.data.map((d, index) => ({
        review: reviews[index],
        embedding: JSON.stringify(d.embedding),
      }));

      const insertQueries = embeddings.map(({ review, embedding }) =>
        client.query(
          "INSERT INTO reviews (restaurant_id, review, embedding) VALUES ($1, $2, $3)",
          [restaurantId, review, embedding]
        )
      );

      await Promise.all(insertQueries);
      console.log("All embeddings generated and stored!");
    } catch (err) {
      console.error("Batch embedding error:", err);
    }
  } catch (err) {
    console.error("Error processing reviews:", err);
  } finally {
    await client.end();
  }
};

const searchRelevantReviews = async (
  restaurantName: string,
  limit: number
): Promise<SearchResult[]> => {
  const client = await dbClient();

  try {
    const prompt = `This was the most delicious, yummy, amazing food ever and the
      dishes served here are absolutely incredible`;
    const embedding = await generateSingleEmbedding(prompt);

    await client.connect();

    const result = await client.query<SearchResult>(
      `SELECT 
              reviews.review,
              1 - (embedding <=> $1::vector) as similarity
           FROM reviews
           JOIN restaurants ON restaurants.id = reviews.restaurant_id
           WHERE restaurants.name = $2
           ORDER BY similarity DESC
           LIMIT $3`,
      [`[${embedding}]`, restaurantName, limit]
    );

    return result.rows;
  } catch (error) {
    console.error("Error searching activities:", error);
    throw error;
  } finally {
    await client.end();
  }
};

const generateSingleEmbedding = async (text: string): Promise<number[]> => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
};

const generateBestDishes = async (name: string, context: string) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `Based on the following customer reviews of a restaurant, provide a refined and engaging summary of the
  best dishes to purchase at the restaurant ${name}. Your tone should be sophisticated, knowledgeable, and evocative — akin 
  to a seasoned food journalist writing for a high-end dining publication. Highlight the standout dishes, their key flavors, 
  textures, and what makes them exceptional. Please do not just select ingredients like egg or mushroom. Please do not recommend things
  like a set menu without making reference to the specific dishes within that set menu which make it special. Please do not
  reference the price of dishes. Please do not recommend general categories of dishes like 'seafood dishes' or 'pasta dishes'. 
  Please ensure that the dishes are as specific as possible and you are recommending actual full meals/dishes which might be 
  ordered by a patron of the restaurant and has previously been ordered by reviewers of the restaurant 
  (like eggs benedict or lobster ravioli or steak frites etc). Please give as specific a name for the dish as you can 
  based on the naming used by the reviewers. If a dish was only available as part of a 'specials' menu, please make
  that clear in your response. Assign some weight to the number of times that a particular dish is mentioned favorably and
  return those dishes which are mentioned over and over again earlier in your response. Look for patterns and explain why these dishes 
  are so loved and highly rated by visitors to the restaurant. Use vivid yet refined language to paint a picture of the dining experience, 
  leveraging the information on the dishes which patrons have provided in their reviews. 
  Avoid clichés and instead offer a nuanced appreciation of the cuisine. Here are the customer reviews for context: 
  ${context}
  If you also have any information on the general vibe and ambience in the restaurant, please feel free to add that as 
  additional information for the user.
  Question: Tell me what are the best dishes to buy at the restaurant ${name}. You have the benefit of recent
  reviews for context and I want you to only base your answers on your reviews. If you can't find any good dishes which the
  reviewers enjoyed or thought were delicious, please say so.`;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content:
            "You are a renowned food critic known for your eloquent and insightful culinary reviews. Your tone should be sophisticated, knowledgeable, and evocative—akin to a seasoned food journalist writing for a high-end dining publication.",
          //"You are a helpful assistant who recommends the best dishes to buy at a restaurant selected by the user. You do this in the voice of Sir David Attenborough with all the associated gravitas and wonder.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.6,
      response_format: zodResponseFormat(BestDishesSchema, "data"),
    });

    return completion.choices[0].message.parsed || "No answer found";
  } catch (error) {
    console.error("Error generating a question:", error);
    throw new Error("Failed to generate a question. Please try again.");
  }
};

export default getBestDishes;
*/
