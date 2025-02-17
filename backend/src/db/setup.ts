import * as dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();

async function setup(): Promise<void> {
  const client = new Client({
    host: "localhost",
    port: 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: "restaurant_reviews",
  });

  try {
    await client.connect();

    // Enable the vector extension
    await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
    // Create table for restaurants
    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id SERIAL PRIMARY KEY,  
        name VARCHAR(255) UNIQUE NOT NULL, 
        place_id TEXT UNIQUE NOT NULL        
      );
    `);
    // Create table for reviews
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,  
        restaurant_id INT NOT NULL,         
        review TEXT NOT NULL,              
        embedding VECTOR(1536) NOT NULL,          
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );
    `);

    await client.query(
      `CREATE UNIQUE INDEX idx_restaurants_name_placeId ON restaurants(name, place_id);`
    );

    await client.query(
      `CREATE INDEX ON reviews USING hnsw (embedding vector_cosine_ops);`
    );
    console.log("Database setup complete!");
  } catch (err) {
    console.error("Error setting up database:", err);
  } finally {
    await client.end();
  }
}

setup().catch((error) => {
  console.error("Unexpected error:", error);
});
