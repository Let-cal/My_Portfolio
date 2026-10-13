import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TracingBeam } from "@/components/fx/TracingBeam";

function stubMedia(matches: (query: string) => boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

class FakeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

afterEach(() => vi.unstubAllGlobals());

describe("TracingBeam", () => {
  it("is full (data-progress=1) under reduced motion", () => {
    stubMedia((q) => q.includes("prefers-reduced-motion"));
    vi.stubGlobal("ResizeObserver", FakeObserver);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const { container } = render(
      <TracingBeam>
        <p>content</p>
      </TracingBeam>,
    );
    expect(container.querySelector("[data-tracing-beam]")).toHaveAttribute("data-progress", "1");
  });

  it("starts empty (data-progress=0) before the visitor scrolls, and renders its children and a decorative svg", () => {
    stubMedia(() => false);
    vi.stubGlobal("ResizeObserver", FakeObserver);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const { container, getByText } = render(
      <TracingBeam>
        <p>content</p>
      </TracingBeam>,
    );
    expect(getByText("content")).toBeInTheDocument();
    expect(container.querySelector("[data-tracing-beam]")).toHaveAttribute("data-progress", "0");
    const svg = container.querySelector("svg");
    expect(svg?.closest("[aria-hidden='true']")).not.toBeNull();
    expect(container.querySelector("[data-beam-head]")).not.toBeNull();
  });
});
