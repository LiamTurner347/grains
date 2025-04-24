import { vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import Loading from "./Loading";

describe("Loading Component", () => {
  // Before each test, replace JS timing functions (setTimeout, setInterval)
  // etc with mock implementations, allowing time control on tests.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  // After each text, clean up and restore original timing functions
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders initial loading message with restaurant name", () => {
    render(<Loading selectedPlaceName="Robinsons Cafe" />);

    expect(
      screen.getByText("Analyzing the best dishes at Robinsons Cafe...")
    ).toBeInTheDocument();
    expect(screen.getByTestId("loader")).toBeInTheDocument();
  });

  it("renders generic message when no restaurant name is provided", () => {
    render(<Loading selectedPlaceName="" />);

    expect(
      screen.getByText(
        "Analyzing the best dishes at the selected restaurant..."
      )
    ).toBeInTheDocument();
  });

  it("cycles through initial loading messages", async () => {
    render(<Loading selectedPlaceName="Robinsons Cafe" />);

    // Initially shows first message
    expect(
      screen.getByText("Analyzing the best dishes at Robinsons Cafe...")
    ).toBeInTheDocument();

    // Fast-forward 5 seconds - act used to ensure React state updates to
    // loadingMessage fully processed before
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should show second message
    expect(
      screen.getByText("Scanning menus and foodie favorites...")
    ).toBeInTheDocument();

    // Fast-forward another 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should show third message
    expect(
      screen.getByText("Checking top-rated dishes loved by locals...")
    ).toBeInTheDocument();

    // Fast-forward another 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should show fourth message
    expect(
      screen.getByText("Comparing reviews to uncover hidden gems...")
    ).toBeInTheDocument();
  });

  it("switches to delay messages after 15 seconds", async () => {
    render(<Loading selectedPlaceName="Robinsons" />);

    // Fast-forward 20 seconds to trigger first delay message
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    // Should show first delay message
    expect(
      screen.getByText(
        "Still crunching the numbers... great dishes come to those who wait!"
      )
    ).toBeInTheDocument();

    // Fast-forward another 5 seconds to trigger second delay message
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should show second delay message
    expect(
      screen.getByText("Analyzing more reviews to get the best results...")
    ).toBeInTheDocument();

    // Fast-forward another 15 seconds to check we cycle back round to first delay message
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    // Should show first delay message
    expect(
      screen.getByText(
        "Still crunching the numbers... great dishes come to those who wait!"
      )
    ).toBeInTheDocument();
  });

  it("resets messages when restaurant name changes", () => {
    // Deconstruct the `rerender` function that allows updating props of rendered components
    const { rerender } = render(<Loading selectedPlaceName="Robinsons Cafe" />);

    // Fast-forward 10 seconds to get to the third message
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Should show third message
    expect(
      screen.getByText("Checking top-rated dishes loved by locals...")
    ).toBeInTheDocument();

    // Change the restaurant name
    rerender(<Loading selectedPlaceName="The Pig and Pastry" />);

    // Should reset to first message with new restaurant name
    expect(
      screen.getByText("Analyzing the best dishes at The Pig and Pastry...")
    ).toBeInTheDocument();
  });
});
