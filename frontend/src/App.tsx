// Imports
import { useState } from "react";
import "./App.css";
import {
  AdvancedMarker,
  APIProvider,
  ControlPosition,
  Map,
  MapControl,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import Header from "./components/Header";
import MapHandler from "./components/MapHandler";
import PlaceAutocomplete from "./components/PlaceAutocomplete";
import SubmitButton from "./components/SubmitButton";
import Loading from "./components/Loading";
import Dishes from "./components/Dishes";
import getBestDishes from "./services/restaurants";
import { Dish } from "./types/types";

// API Key retrieved from environment variables
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY!;

const App = () => {
  const [selectedPlace, setSelectedPlace] =
    useState<google.maps.places.PlaceResult | null>(null);
  // Marker created but not yet placed (see position ={null} in the associated
  // AdvancedMarker component). When user selects a place, the marker will
  // move to that location.
  // When a place is selected in the autocomplete search, the MapHandler
  // component adjusts the map.
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [bestDishes, setBestDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGetBestDishes = async (name: string, id: string) => {
    setLoading(true);
    try {
      const result = await getBestDishes(name, id);
      setBestDishes(result.bestDishes.bestDishes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <APIProvider apiKey={API_KEY}>
        <div className="map-container">
          <Map
            mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID}
            defaultZoom={13}
            defaultCenter={{ lat: 53.95190272181878, lng: -1.08476205000001 }}
          >
            <AdvancedMarker ref={markerRef} position={null} />
            <MapControl position={ControlPosition.TOP}>
              <div className="autocomplete-control">
                <PlaceAutocomplete onPlaceSelect={setSelectedPlace} />
              </div>
            </MapControl>
            <MapHandler
              place={selectedPlace}
              marker={marker}
              setBestDishes={setBestDishes}
            />
          </Map>
        </div>
      </APIProvider>
      {selectedPlace && !loading && bestDishes.length === 0 && (
        <SubmitButton
          selectedPlaceName={selectedPlace?.name ?? ""}
          selectedPlaceId={selectedPlace?.place_id ?? ""}
          onGetBestDishes={handleGetBestDishes}
        />
      )}
      {loading && <Loading selectedPlaceName={selectedPlace?.name ?? ""} />}
      {!loading && bestDishes.length !== 0 && (
        <Dishes
          bestDishes={bestDishes}
          selectedPlaceName={selectedPlace?.name ?? ""}
        />
      )}
    </>
  );
};

export default App;
