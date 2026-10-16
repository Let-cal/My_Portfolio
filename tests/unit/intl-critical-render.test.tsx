import { afterEach, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { LocalTime } from "@/components/fx/LocalTime";
import { NumberTicker } from "@/components/fx/NumberTicker";
import { act, cleanup, render, screen } from "@testing-library/react";

vi.mock("@/components/fx/use-media-query", () => ({ usePrefersReducedMotion: () => true }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("starts the live clock only when its unchanged placeholder approaches the viewport", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T07:32:00Z"));
  let enter: IntersectionObserverCallback | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { enter = callback; }
    observe() {}
    disconnect = disconnect;
  });
  const constructor = vi.spyOn(Intl, "DateTimeFormat");
  const { unmount } = render(<LocalTime />);
  expect(screen.getByText("--:-- (GMT+7)")).toBeInTheDocument();
  expect(constructor).not.toHaveBeenCalled();
  act(() => enter?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(screen.getByText("14:32 (GMT+7)")).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByText("14:33 (GMT+7)")).toBeInTheDocument();
  expect(constructor).toHaveBeenCalledTimes(1);
  unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps the owner's fixed SSR clock placeholder without constructing a date formatter", () => {
  const constructor = vi.spyOn(Intl, "DateTimeFormat");
  const html = renderToString(<LocalTime />);
  expect(html).toContain("--:-- (GMT+7)");
  expect(html).toContain("min-width:13ch");
  expect(constructor).not.toHaveBeenCalled();
});

it("formats ticker values without repeated native toLocaleString formatter setup", () => {
  const locale = vi.spyOn(Number.prototype, "toLocaleString");
  const html = renderToString(<><NumberTicker value={1200} prefix="~" suffix="+" /><NumberTicker value={2.5} /><NumberTicker value={14} /></>);
  expect(html).toContain("~1,200+");
  expect(html).toContain("2.5");
  expect(html).toContain('aria-label="14"');
  expect(locale).not.toHaveBeenCalled();
});

it("uses server-prepared ticker text without constructing a formatter during hydration", () => {
  const constructor = vi.spyOn(Intl, "NumberFormat");
  render(<NumberTicker value={1.23456} formattedValue="~1.23456+" prefix="~" suffix="+" />);
  expect(screen.getByRole("img", { name: "~1.23456+" })).toBeInTheDocument();
  expect(constructor).not.toHaveBeenCalled();
});
