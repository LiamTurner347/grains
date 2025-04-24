import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Dishes from "./Dishes";

describe("Dishes Component", () => {
  const mockDishes = [
    {
      name: "Truffle Mushroom Toast",
      description:
        "A sublime creation that marries the earthiness of truffle with the rich, umami depth of mushrooms, all elegantly presented on a slice of perfectly toasted sourdough.",
    },
    {
      name: "Caramel Banana Pancakes",
      description:
        "These pancakes are a towering testament to indulgence, layered with a luscious caramel sauce that cascades through the stack, ensuring every bite is as decadent as the last.",
    },
  ];

  const mockScrollIntoView = vi.fn();
  // Mock scrollIntoView method / behaviour on all elements on the page
  beforeEach(() => {
    Element.prototype.scrollIntoView = mockScrollIntoView;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders restaurant name as title", () => {
    render(
      <Dishes bestDishes={mockDishes} selectedPlaceName="Robinsons Cafe" />
    );

    const titleElement = screen.getByRole("heading", { level: 1 });
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveTextContent("Robinsons Cafe");
  });

  it("renders all dishes with name and description", () => {
    render(
      <Dishes bestDishes={mockDishes} selectedPlaceName="Robinsons Cafe" />
    );

    expect(screen.getByText("Truffle Mushroom Toast")).toBeInTheDocument();
    expect(
      screen.getByText(
        /A sublime creation that marries the earthiness of truffle/
      )
    ).toBeInTheDocument();

    expect(screen.getByText("Caramel Banana Pancakes")).toBeInTheDocument();
    expect(
      screen.getByText(
        /a towering testament to indulgence, layered with a luscious caramel sauce/
      )
    ).toBeInTheDocument();
  });

  it("scrolls into view when rendered", () => {
    render(
      <Dishes bestDishes={mockDishes} selectedPlaceName="Robinsons Cafe" />
    );

    expect(mockScrollIntoView).toHaveBeenCalledTimes(1);
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("renders correctly with no dishes", () => {
    render(<Dishes bestDishes={[]} selectedPlaceName="Empty Restaurant" />);

    const titleElement = screen.getByRole("heading", { level: 1 });
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveTextContent("Empty Restaurant");
  });
});
