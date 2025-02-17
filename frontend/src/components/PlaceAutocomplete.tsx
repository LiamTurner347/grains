import { useState, useRef, useEffect } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

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
      fields: [
        "geometry",
        "name",
        "formatted_address",
        "place_id",
        "url",
        "rating",
        "user_ratings_total",
      ],
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

export default PlaceAutocomplete;
