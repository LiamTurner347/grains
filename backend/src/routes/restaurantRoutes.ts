import express from "express";
import getBestDishes from "../controllers/getBestDishes";
// import pgQuery from "../db/models/postgresModel";

const restaurantRouter = express.Router();

restaurantRouter.get("/:name/:id/best-dishes", getBestDishes);

export default restaurantRouter;
