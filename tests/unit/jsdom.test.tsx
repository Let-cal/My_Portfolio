import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

it("jsdom + jest-dom work", () => {
  render(<button>hi</button>);
  expect(screen.getByRole("button")).toBeInTheDocument();
  expect(typeof document).toBe("object");
});
