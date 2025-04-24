import { render, screen } from "@testing-library/react";
import Header from "./Header";

// Mock the logo import and replace it with a simple string for testing
vi.mock("../assets/logo.png", () => ({
  default: "mocked-logo-path",
}));

describe("Header Component", () => {
  it("renders the header with logo", () => {
    render(<Header />);

    const headerElement = screen.getByRole("banner");
    expect(headerElement).toBeInTheDocument();
    expect(headerElement).toHaveClass("header");

    const logoElement = screen.getByAltText("Logo");
    expect(logoElement).toBeInTheDocument();
    expect(logoElement).toHaveClass("header-logo");
    expect(logoElement).toHaveAttribute("src", "mocked-logo-path");
  });
});
