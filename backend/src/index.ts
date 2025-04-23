import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

import restaurantRouter from "./routes/restaurantRoutes";

const app = express();
const PORT = process.env.EXPRESS_PORT || 3000;

app.use(morgan("tiny"));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/restaurants", restaurantRouter);

app.get("*", (req, res) => {
  res.status(404).send("Route not found");
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
