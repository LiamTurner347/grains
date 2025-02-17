import { OpenAI } from "openai";
import { BestDishesSchema, BestDishes, Embeddings } from "../types/types";
import { zodResponseFormat } from "openai/helpers/zod";
import * as dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateSingleEmbedding = async (
  text: string
): Promise<number[]> => {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
};

export const generateBestDishes = async (
  name: string,
  context: string
): Promise<BestDishes> => {
  const prompt = `
    You are a renowned food critic writing for a high-end dining magazine.
    Based on the customer reviews, provide a refined and engaging summary of the best dishes at **${name}**.

    **Guidelines:**
    - **Highlight standout dishes**, their **key flavors** and **textures**.
    - **Do not list general dish categories** like "seafood" or "pasta."
    - **Focus on specific dish names** mentioned by multiple reviewers. If a dish is praised a number of times, 
    give it additional merit, weight and precedence. 
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
};

export const generateReviewEmbeddings = async (
  name: string,
  placeID: string,
  reviews: string[]
): Promise<Embeddings[]> => {
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
  } catch (err) {
    console.error("Batch embedding error:", err);
    throw err;
  }
};
