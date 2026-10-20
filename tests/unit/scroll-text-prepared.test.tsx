import { afterEach, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ScrollTextReveal } from "@/components/fx/ScrollTextReveal";

vi.mock("@/components/fx/use-media-query", () => ({
  usePrefersReducedMotion: () => false,
}));
afterEach(() => vi.restoreAllMocks());
const preparedTokens = [
  { text: "I", unit: 0 },
  { text: " ", unit: null },
  { text: "build", unit: 1 },
];

it("uses prepared word units without running Intl during hydration", () => {
  const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
  const html = renderToString(
    <ScrollTextReveal
      text="I build"
      locale="en"
      preparedTokens={preparedTokens}
    />,
  );
  expect(html).toContain("I build");
  expect(segment).not.toHaveBeenCalled();
});

it("keeps exactly the same accessible and animated markup", () => {
  const normal = renderToString(
    <ScrollTextReveal text="I build" locale="en" />,
  );
  const prepared = renderToString(
    <ScrollTextReveal
      text="I build"
      locale="en"
      preparedTokens={preparedTokens}
    />,
  );
  expect(prepared).toBe(normal);
});
