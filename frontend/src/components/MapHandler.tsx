import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { Dish } from "../types/types";

interface MapHandlerProps {
  place: google.maps.places.PlaceResult | null;
  marker: google.maps.marker.AdvancedMarkerElement | null;
  setBestDishes: React.Dispatch<React.SetStateAction<Dish[]>>;
}

// When a place is selected in the autocomplete search, MapHandler adjusts the map
const MapHandler = ({ place, marker, setBestDishes }: MapHandlerProps) => {
  // When a new place is selected:
  // The map adjusts to fit the selected place (fitBounds).
  // The marker moves to the new location.
  const map = useMap();

  useEffect(() => {
    if (!map || !place || !marker) return;

    if (place.geometry?.viewport) {
      map.fitBounds(place.geometry?.viewport);
    }
    marker.position = place.geometry?.location;
    setBestDishes([]);
  }, [map, place, marker, setBestDishes]);

  return null;
};

export default MapHandler;
