import { vi, afterEach, describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import getBestDishes from "./services/restaurants";
import App from "./App";
import { MockPlaceResult, BestDishesResponse } from "./types/testTypes";

const mockRestaurantData: MockPlaceResult = {
  name: "Robinsons Cafe",
  place_id: "place123",
  geometry: {
    location: { lat: () => 40.7128, lng: () => -74.006 },
    viewport: {
      getNorthEast: () => ({ lat: () => 40.72, lng: () => -74.0 }),
      getSouthWest: () => ({ lat: () => 40.7, lng: () => -74.01 }),
    },
  },
};

const mockApiResponse: BestDishesResponse = {
  bestDishes: {
    bestDishes: [
      {
        name: "Truffle Mushroom Toast",
        description:
          "A sublime creation that marries the earthiness of truffle with the rich, umami depth of mushrooms, all elegantly presented on a slice of perfectly toasted sourdough.",
      },
    ],
  },
};

// Mock the react-google-maps library
vi.mock("@vis.gl/react-google-maps", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@vis.gl/react-google-maps")
  >();
  return {
    ...actual,
    APIProvider: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Map: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="map">{children}</div>
    ),
    MapControl: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AdvancedMarker: vi.fn(),
    useAdvancedMarkerRef: () => [null, null],
    useMap: () => ({ fitBounds: vi.fn() }),
    useMapsLibrary: () => null,
    ControlPosition: { TOP: "TOP" },
  };
});

vi.mock("./services/restaurants.ts");
const mockedRestaurantService = vi.mocked({ getBestDishes }, true);

// Mock the PlaceAutocomplete component to simulate a user selecting a restaurant
// with the mockRestaurantData
vi.mock("./components/PlaceAutocomplete", () => ({
  default: ({
    onPlaceSelect,
  }: {
    onPlaceSelect: (place: MockPlaceResult) => void;
  }) => (
    <button
      data-testid="autocomplete-button"
      onClick={() => onPlaceSelect(mockRestaurantData)}
    >
      Search
    </button>
  ),
}));

// Mock the scrollIntoView method
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  vi.resetAllMocks();
});

describe("App Component", () => {
  it("renders header and map on initial render", () => {
    render(<App />);

    // Header should be visible (we can test for actual content rather than test ID)
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByTestId("map")).toBeInTheDocument();
  });

  it("shows submit button after selecting a place", async () => {
    render(<App />);

    // Initial state - no submit button
    await expect(
      screen.findByText(/Discover the best dishes/)
    ).rejects.toThrow();

    // Select a place
    await userEvent.click(screen.getByTestId("autocomplete-button"));

    // Submit button should appear
    expect(
      await screen.findByText(
        `Discover the best dishes at ${mockRestaurantData.name}`
      )
    ).toBeInTheDocument();
  });

  it("shows loading when fetching dishes", async () => {
    // Mock the API to return a never-resolving promise
    // so the component stays in loading state
    mockedRestaurantService.getBestDishes.mockReturnValue(
      new Promise(() => {})
    );
    render(<App />);

    // Mock autocompletion of selected place
    const autocompleteSelection = screen.getByTestId("autocomplete-button");
    await userEvent.click(autocompleteSelection);

    // Click submit button
    const submitButton = screen.getByText(
      `Discover the best dishes at ${mockRestaurantData.name}`
    );
    await userEvent.click(submitButton);

    // Loading should appear
    expect(
      screen.getByText(
        `Analyzing the best dishes at ${mockRestaurantData.name}...`
      )
    ).toBeInTheDocument();
  });

  it("displays dishes after loading completes", async () => {
    // Mock successful API response and Promise resolved with mockApiResponse data
    mockedRestaurantService.getBestDishes.mockResolvedValue(mockApiResponse);

    render(<App />);

    // Mock autocompletion of selected place
    const autocompleteSelection = screen.getByTestId("autocomplete-button");
    await userEvent.click(autocompleteSelection);

    // Click submit button
    const submitButton = screen.getByText(
      `Discover the best dishes at ${mockRestaurantData.name}`
    );
    await userEvent.click(submitButton);

    // Wait for dishes to load
    await waitFor(() => {
      console.log("Current DOM:", document.body.innerHTML);
      expect(screen.getByText(mockRestaurantData.name)).toBeInTheDocument();
      expect(screen.getByText("Truffle Mushroom Toast")).toBeInTheDocument();
      expect(
        screen.getByText(
          /A sublime creation that marries the earthiness of truffle/
        )
      ).toBeInTheDocument();
    });
  });

  it("handles API error gracefully", async () => {
    // Mock API error
    mockedRestaurantService.getBestDishes.mockRejectedValue(
      new Error("API Error")
    );

    // Spy on console.error
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<App />);

    // Mock autocompletion of selected place
    const autocompleteSelection = screen.getByTestId("autocomplete-button");
    await userEvent.click(autocompleteSelection);

    // Click submit button
    const submitButton = screen.getByText(
      `Discover the best dishes at ${mockRestaurantData.name}`
    );
    await userEvent.click(submitButton);

    // Wait for error to be handled
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
      // Submit button should reappear after error
      expect(
        screen.getByText(
          `Discover the best dishes at ${mockRestaurantData.name}`
        )
      ).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });
});
