import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubmitButton from "./SubmitButton";

const onGetBestDishes = vi.fn();

describe("SubmitButton Component", () => {
  it("renders submit button with restaurant name when provided", () => {
    render(
      <SubmitButton
        selectedPlaceName="Robinsons Cafe"
        selectedPlaceId="place123"
        onGetBestDishes={onGetBestDishes}
      />
    );

    const submitButton = screen.getByRole("button");
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveTextContent(
      "Discover the best dishes at Robinsons Cafe"
    );
    expect(submitButton).not.toBeDisabled();
  });

  it("calls onGetBestDishes when clicked", async () => {
    render(
      <SubmitButton
        selectedPlaceName="Robinsons Cafe"
        selectedPlaceId="place123"
        onGetBestDishes={onGetBestDishes}
      />
    );

    const submitButton = screen.getByRole("button");
    await userEvent.click(submitButton);

    expect(onGetBestDishes).toHaveBeenCalledTimes(1);
    expect(onGetBestDishes).toHaveBeenCalledWith("Robinsons Cafe", "place123");
  });

  it("is disabled when place ID is missing", () => {
    render(
      <SubmitButton
        selectedPlaceName="Robinsons Cafe"
        selectedPlaceId=""
        onGetBestDishes={onGetBestDishes}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("is disabled when place name is missing", () => {
    render(
      <SubmitButton
        selectedPlaceName=""
        selectedPlaceId="place123"
        onGetBestDishes={onGetBestDishes}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("is disabled when neither place name nor place id is provided", () => {
    render(
      <SubmitButton
        selectedPlaceName=""
        selectedPlaceId=""
        onGetBestDishes={onGetBestDishes}
      />
    );

    const submitButton = screen.getByRole("button");
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveTextContent("");
    expect(submitButton).toBeDisabled();
  });
});
