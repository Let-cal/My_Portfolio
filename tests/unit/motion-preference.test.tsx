import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NumberTicker } from "@/components/fx/NumberTicker";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { MotionToggle } from "@/components/site/MotionToggle";
import { MOTION_INIT_SCRIPT } from "@/components/site/motion-script";
import { getMotionPreference, setMotionPreference, useMotionPreference } from "@/components/site/motion-preference";
import en from "@/messages/en.json";

const html = document.documentElement;

/** Stubs matchMedia so the OS reports `osReduce` for prefers-reduced-motion. */
function stubOs(osReduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: osReduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  localStorage.clear();
  html.removeAttribute("data-motion");
});
afterEach(() => vi.unstubAllGlobals());

describe("motion preference store", () => {
  it("defaults to system and follows the OS setting", () => {
    stubOs(true);
    const { result } = renderHook(() => useMotionPreference());
    expect(result.current.pref).toBe("system");
    expect(result.current.reduced).toBe(true);
  });

  it("system without OS reduce is not reduced", () => {
    stubOs(false);
    expect(renderHook(() => useMotionPreference()).result.current.reduced).toBe(false);
  });

  it("on overrides an OS reduce, is saved and marks <html data-motion=full>", () => {
    stubOs(true);
    const { result } = renderHook(() => useMotionPreference());
    act(() => setMotionPreference("on"));
    expect(result.current.pref).toBe("on");
    expect(result.current.reduced).toBe(false);
    expect(localStorage.getItem("motion")).toBe("on");
    expect(html.dataset.motion).toBe("full");
  });

  it("off is reduced even when the OS allows motion, and system clears the saved value", () => {
    stubOs(false);
    const { result } = renderHook(() => useMotionPreference());
    act(() => setMotionPreference("off"));
    expect(result.current.reduced).toBe(true);
    expect(localStorage.getItem("motion")).toBe("off");
    expect(html.dataset.motion).toBe("reduced");
    act(() => setMotionPreference("system"));
    expect(localStorage.getItem("motion")).toBeNull();
    expect(getMotionPreference()).toBe("system");
    expect(html.dataset.motion).toBe("full");
  });

  it("ignores junk in storage", () => {
    localStorage.setItem("motion", "banana");
    expect(getMotionPreference()).toBe("system");
  });
});

describe("pre-paint script", () => {
  const run = () => new Function(MOTION_INIT_SCRIPT)();

  it("saved on beats an OS reduce", () => {
    stubOs(true);
    localStorage.setItem("motion", "on");
    run();
    expect(html.dataset.motion).toBe("full");
  });

  it("saved off beats an OS that allows motion", () => {
    stubOs(false);
    localStorage.setItem("motion", "off");
    run();
    expect(html.dataset.motion).toBe("reduced");
  });

  it("without a saved value it follows the OS", () => {
    stubOs(true);
    run();
    expect(html.dataset.motion).toBe("reduced");
    stubOs(false);
    run();
    expect(html.dataset.motion).toBe("full");
  });
});

function renderToggle() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MotionToggle />
    </NextIntlClientProvider>,
  );
}

describe("MotionToggle", () => {
  it("flips aria-pressed and <html data-motion> on click, starting from the effective state", () => {
    stubOs(true);
    renderToggle();
    const button = screen.getByRole("button", { name: en.motion.label });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(html.dataset.motion).toBe("full");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(html.dataset.motion).toBe("reduced");
    expect(localStorage.getItem("motion")).toBe("off");
  });

  it("the first click from system turns motion off when the OS allows it", () => {
    stubOs(false);
    renderToggle();
    const button = screen.getByRole("button", { name: en.motion.label });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(localStorage.getItem("motion")).toBe("off");
  });
});

describe("usePrefersReducedMotion", () => {
  it("returns the effective value, not the raw OS media query", () => {
    stubOs(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
    act(() => setMotionPreference("on"));
    expect(result.current).toBe(false);
  });

  it("NumberTicker counts up when motion is on even though the OS asks for reduced motion", () => {
    stubOs(true);
    setMotionPreference("on");
    vi.useFakeTimers();
    let trigger: IntersectionObserverCallback = () => {};
    class IO {
      constructor(cb: IntersectionObserverCallback) {
        trigger = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", IO);
    render(<NumberTicker value={14} />);
    const shown = () => screen.getByLabelText("14").querySelector("[data-ticker-value]")?.textContent;
    expect(shown()).not.toBe("14");
    act(() => trigger([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(shown()).toBe("14");
    vi.useRealTimers();
  });
});

describe("globals.css", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  it("no longer keys off the raw OS media query", () => {
    expect(css).not.toContain("@media (prefers-reduced-motion");
  });

  it("redefines the Tailwind motion variants on data-motion", () => {
    expect(css).toContain("@custom-variant motion-reduce");
    expect(css).toContain("@custom-variant motion-safe");
    expect(css).toMatch(/@custom-variant motion-reduce \(&:where\(\[data-motion=reduced\], \[data-motion=reduced\] \*\)\)/);
  });
});
