import express from "express";
import getBestDishes from "../controllers/getBestDishes";

const restaurantRouter = express.Router();

restaurantRouter.get("/:name/:id/best-dishes", getBestDishes);

export default restaurantRouter;
