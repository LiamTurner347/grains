// Imports
import { useState, useRef, useEffect } from "react";
import "./App.css";
import {
  AdvancedMarker,
  APIProvider,
  ControlPosition,
  Map,
  MapControl,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

//API Key retrieved from environment variables
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

  return (
    <>
      <h1 className="title">GRAINS AND TRAILS</h1>
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
            <MapHandler place={selectedPlace} marker={marker} />
          </Map>
        </div>
      </APIProvider>
      {selectedPlace && (
        <p>Find the best places to eat at {selectedPlace.name}</p>
      )}
    </>
  );
};

interface MapHandlerProps {
  place: google.maps.places.PlaceResult | null;
  marker: google.maps.marker.AdvancedMarkerElement | null;
}

// When a place is selected in the autocomplete search, MapHandler adjusts the map
const MapHandler = ({ place, marker }: MapHandlerProps) => {
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
  }, [map, place, marker]);

  return null;
};

interface PlaceAutocompleteProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult | null) => void;
}

// The Autocomplete component provides search functionality for locations.
const PlaceAutocomplete = ({ onPlaceSelect }: PlaceAutocompleteProps) => {
  const [placeAutocomplete, setPlaceAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary("places");

  // A Google Places Autocomplete instance is created when the component mounts.
  // It attaches to an input field, allowing users to search for places.
  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options = {
      fields: ["geometry", "name", "formatted_address"],
    };

    const autocompleteInstance = new places.Autocomplete(
      inputRef.current,
      options
    );
    setPlaceAutocomplete(autocompleteInstance);
  }, [places]);

  // When a user selects a place, the selected place details are passed back.
  // The selectedPlace state is updated to reflect.
  useEffect(() => {
    if (!placeAutocomplete) return;

    placeAutocomplete.addListener("place_changed", () => {
      onPlaceSelect(placeAutocomplete.getPlace());
    });
  }, [onPlaceSelect, placeAutocomplete]);

  return (
    <div className="autocomplete-container">
      <input ref={inputRef} />
    </div>
  );
};

export default App;
