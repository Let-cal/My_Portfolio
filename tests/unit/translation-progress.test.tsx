import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TranslationProgress } from "@/components/admin/TranslationProgress";
it("uses the shared nested translation denominator and accessible per-locale progress", () => {
  render(
    <TranslationProgress
      value={{
        a: { en: "A", ja: "あ", vi: "" },
        b: [{ en: "B", ja: "", vi: "B" }],
      }}
    />,
  );
  expect(
    screen
      .getByRole("progressbar", { name: "EN 2/2" })
      .getAttribute("aria-valuenow"),
  ).toBe("2");
  expect(screen.getByRole("progressbar", { name: "JA 1/2" })).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "VI 1/2" })).toBeTruthy();
});
it("does not invent progress for an item with no translatable fields", () => {
  const { container } = render(
    <TranslationProgress value={{ name: "plain" }} />,
  );
  expect(container.textContent).toBe("");
});
it("counts schema-valid missing JA/VI as untranslated rather than hiding the item", () => {
  render(<TranslationProgress value={{ description: { en: "English" } }} />);
  expect(screen.getByRole("progressbar", { name: "JA 0/1" })).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "VI 0/1" })).toBeTruthy();
});
