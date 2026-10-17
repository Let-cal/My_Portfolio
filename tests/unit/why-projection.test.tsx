import { act, render } from "@testing-library/react";
import { domMax, LazyMotion } from "motion/react";
import { afterEach, expect, it, vi } from "vitest";
import { WhyCarousel } from "@/components/sections/why/WhyCarousel";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/fx/use-media-query", () => ({ usePrefersReducedMotion: () => false }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("does not read offscreen drag geometry before approach", () => {
  let enter: IntersectionObserverCallback;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { enter = callback; }
    observe() {} disconnect() {}
  });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 300, width: 1200, height: 300, toJSON() {},
  });
  render(<LazyMotion features={domMax} strict><WhyCarousel cards={[{ id: "a", content: <p>One</p> }, { id: "b", content: <p>Two</p> }]} /></LazyMotion>);
  expect(bounds).not.toHaveBeenCalled();
  act(() => enter([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(bounds).toHaveBeenCalled();
});
