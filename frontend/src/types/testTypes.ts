export interface MockPlaceResult {
  name: string;
  place_id: string;
  geometry?: {
    location: { lat: () => number; lng: () => number };
    viewport: {
      getNorthEast: () => { lat: () => number; lng: () => number };
      getSouthWest: () => { lat: () => number; lng: () => number };
    };
  };
}

export interface BestDishesResponse {
  bestDishes: {
    bestDishes: Array<{
      name: string;
      description: string;
    }>;
  };
}
