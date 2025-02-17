import { useRef, useEffect } from "react";
import { Dish } from "../types/types";
import { motion } from "framer-motion";

interface DishesProps {
  bestDishes: Dish[];
  selectedPlaceName: string;
}

const Dishes = ({ bestDishes, selectedPlaceName }: DishesProps) => {
  const dishRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dishRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <motion.div
      ref={dishRef}
      className="dish-container"
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <h1 className="title">{selectedPlaceName}</h1>
      <div>
        {bestDishes.map((dish, index) => (
          <p key={index} className="best-dishes">
            <strong>{dish.name}</strong>: {dish.description}
          </p>
        ))}
      </div>
    </motion.div>
  );
};

export default Dishes;
