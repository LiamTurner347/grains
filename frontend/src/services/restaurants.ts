import axios from "axios";

export const getBestDishes = async (name: string, id: string) => {
  const { data } = await axios.get(
    `/api/restaurants/${name}/${id}/best-dishes`
  );
  return data;
};

export default getBestDishes;
