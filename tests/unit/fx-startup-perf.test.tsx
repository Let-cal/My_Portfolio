import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KineticText } from "@/components/fx/KineticText";
import { LocalTime } from "@/components/fx/LocalTime";
import { Marquee } from "@/components/fx/Marquee";
import { WhyCarousel } from "@/components/sections/why/WhyCarousel";

vi.mock("@/components/fx/use-media-query", () => ({ usePrefersReducedMotion: () => false }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string, values?: { current?: number; total?: number }) =>
  key === "slideStatus" ? `${values?.current} of ${values?.total}` : key }));

function observers() {
  const intersections: IO[] = [], resizes: RO[] = [];
  class IO {
    targets: Element[] = [];
    disconnect = vi.fn();
    constructor(readonly callback: IntersectionObserverCallback, readonly options: IntersectionObserverInit) { intersections.push(this); }
    observe(target: Element) { this.targets.push(target); }
  }
  class RO {
    targets: Element[] = [];
    disconnect = vi.fn();
    constructor(readonly callback: ResizeObserverCallback) { resizes.push(this); }
    observe(target: Element) { this.targets.push(target); }
  }
  vi.stubGlobal("IntersectionObserver", IO);
  vi.stubGlobal("ResizeObserver", RO);
  const enter = (observer = intersections.at(-1)!, visible = true) => act(() => observer.callback(
    [{ target: observer.targets[0], isIntersecting: visible } as IntersectionObserverEntry], observer as unknown as IntersectionObserver,
  ));
  const resize = (width: number, observer = resizes.at(-1)!) => act(() => observer.callback(
    [{ target: observer.targets[0], borderBoxSize: [{ inlineSize: width, blockSize: 20 }] } as unknown as ResizeObserverEntry], observer as unknown as ResizeObserver,
  ));
  return { intersections, resizes, enter, resize };
}

const cards = [0, 1, 2].map((i) => ({ id: String(i), content: <a href={`#${i}`}>card {i}</a> }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("startup geometry stays dormant until approach", () => {
  it("keeps marquee markup but does no layout reads or resize setup before IO; delivered border-box widths set speed", () => {
    const o = observers();
    const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect");
    const { container, rerender, unmount } = render(<Marquee speed={40}><span>React</span></Marquee>);
    const track = container.querySelector<HTMLElement>(".fx-marquee-track")!;
    expect(screen.getAllByText("React")).toHaveLength(2);
    expect(bounds).not.toHaveBeenCalled();
    expect(o.resizes).toHaveLength(0);
    expect(o.intersections[0].options.rootMargin).toBe("600px");
    o.enter(undefined, false);
    expect(o.resizes).toHaveLength(0);
    o.enter();
    expect(o.resizes).toHaveLength(1);
    expect(bounds).not.toHaveBeenCalled();
    o.resize(480);
    expect(track.style.getPropertyValue("--fx-marquee-duration")).toBe("12s");
    o.resize(640);
    expect(track.style.getPropertyValue("--fx-marquee-duration")).toBe("16s");
    expect(bounds).not.toHaveBeenCalled();
    rerender(<Marquee speed={80}><span>React</span></Marquee>);
    expect(o.resizes[0].disconnect).toHaveBeenCalled();
    o.enter(); o.resize(640);
    expect(track.style.getPropertyValue("--fx-marquee-duration")).toBe("8s");
    const lastResize = o.resizes.at(-1)!;
    unmount();
    expect(lastResize.disconnect).toHaveBeenCalled();
    o.resize(800, lastResize);
    expect(track.style.getPropertyValue("--fx-marquee-duration")).toBe("8s");
  });

  it("uses ResizeObserver without synchronous bounds reads when IO is unavailable", () => {
    const o = observers(); vi.stubGlobal("IntersectionObserver", undefined);
    const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect");
    const { container } = render(<Marquee speed={20}>Fallback</Marquee>);
    expect(o.resizes).toHaveLength(1);
    o.resize(200);
    expect(container.querySelector<HTMLElement>(".fx-marquee-track")!.style.getPropertyValue("--fx-marquee-duration")).toBe("10s");
    expect(bounds).not.toHaveBeenCalled();
  });

  it("supports the older single-object borderBoxSize shape without reading layout", () => {
    const o = observers();
    const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect");
    const { container } = render(<Marquee speed={20}>Legacy RO</Marquee>);
    o.enter();
    const observer = o.resizes[0];
    act(() => observer.callback([{ target: observer.targets[0], borderBoxSize: { inlineSize: 240, blockSize: 20 } } as unknown as ResizeObserverEntry], observer as unknown as ResizeObserver));
    expect(container.querySelector<HTMLElement>(".fx-marquee-track")!.style.getPropertyValue("--fx-marquee-duration")).toBe("12s");
    expect(bounds).not.toHaveBeenCalled();
  });

  it("retains eager measurement without either observer, with font updates cleaned up on unmount", () => {
    vi.stubGlobal("IntersectionObserver", undefined); vi.stubGlobal("ResizeObserver", undefined);
    const fonts = new EventTarget();
    vi.stubGlobal("document", document);
    const original = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
    try {
      const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 320 } as DOMRect);
      const { container, unmount } = render(<Marquee speed={40}>No observers</Marquee>);
      const track = container.querySelector<HTMLElement>(".fx-marquee-track")!;
      expect(track.style.getPropertyValue("--fx-marquee-duration")).toBe("8s");
      bounds.mockReturnValue({ width: 480 } as DOMRect);
      act(() => fonts.dispatchEvent(new Event("loadingdone")));
      expect(track.style.getPropertyValue("--fx-marquee-duration")).toBe("12s");
      unmount(); bounds.mockClear(); fonts.dispatchEvent(new Event("loadingdone"));
      expect(bounds).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(document, "fonts", original);
      else Reflect.deleteProperty(document, "fonts");
    }
  });

  it("still measures marquee width after approach without ResizeObserver and updates on window resize", () => {
    const o = observers(); vi.stubGlobal("ResizeObserver", undefined);
    const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: 320 } as DOMRect);
    const { container, unmount } = render(<Marquee speed={40}>Fallback</Marquee>);
    expect(bounds).not.toHaveBeenCalled();
    o.enter();
    const track = container.querySelector<HTMLElement>(".fx-marquee-track")!;
    expect(track.style.getPropertyValue("--fx-marquee-duration")).toBe("8s");
    bounds.mockReturnValue({ width: 400 } as DOMRect);
    fireEvent(window, new Event("resize"));
    expect(track.style.getPropertyValue("--fx-marquee-duration")).toBe("10s");
    unmount(); bounds.mockClear(); fireEvent(window, new Event("resize"));
    expect(bounds).not.toHaveBeenCalled();
  });

  it("cleans up an unopened gate, ignores late notifications, and survives StrictMode effect replay", () => {
    const o = observers();
    const { unmount } = render(<StrictMode><Marquee>Strict</Marquee></StrictMode>);
    expect(o.resizes).toHaveLength(0);
    expect(o.intersections[0].disconnect).toHaveBeenCalled();
    o.enter(o.intersections[0]); expect(o.resizes).toHaveLength(0);
    o.enter(); expect(o.resizes).toHaveLength(1);
    unmount(); expect(o.resizes[0].disconnect).toHaveBeenCalled();
    o.enter(); expect(o.resizes).toHaveLength(1);
  });

  it("does not measure carousel widths off screen, then retains resize and keyboard navigation after approach", () => {
    const o = observers();
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1200);
    const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect");
    const { unmount } = render(<WhyCarousel cards={cards} />);
    expect(width).not.toHaveBeenCalled(); expect(scroll).not.toHaveBeenCalled();
    expect(bounds).not.toHaveBeenCalled(); expect(o.resizes).toHaveLength(0);
    o.enter();
    expect(width).toHaveBeenCalled(); expect(scroll).toHaveBeenCalled();
    const observer = o.resizes.at(-1)!;
    expect(observer.targets).toHaveLength(2);
    width.mockClear(); o.resize(500, observer); expect(width).toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowRight" });
    expect(screen.getByRole("status")).toHaveTextContent("2 of 3");
    unmount(); expect(observer.disconnect).toHaveBeenCalled();
    width.mockClear(); o.resize(600, observer); expect(width).not.toHaveBeenCalled();
  });

  it("starts carousel measurement without IO and initializes on focus before the first IO delivery", () => {
    observers(); vi.stubGlobal("IntersectionObserver", undefined);
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get");
    const first = render(<WhyCarousel cards={cards} />);
    expect(width).toHaveBeenCalled(); first.unmount();
    const o = observers(); width.mockClear();
    render(<WhyCarousel cards={cards} />);
    expect(width).not.toHaveBeenCalled();
    fireEvent.focusIn(screen.getByRole("region"));
    expect(width).toHaveBeenCalled(); expect(o.resizes).toHaveLength(1);
    o.enter(); expect(o.resizes).toHaveLength(1);
  });

  it("initializes on the first pointer event and re-arms safely when the carousel card count changes", () => {
    const o = observers();
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get");
    const { container, rerender, unmount } = render(<WhyCarousel cards={cards} />);
    expect(width).not.toHaveBeenCalled();
    fireEvent.pointerDown(container.firstElementChild!);
    expect(width).toHaveBeenCalled();
    const firstResize = o.resizes[0];
    rerender(<WhyCarousel cards={cards.slice(0, 2)} />);
    expect(firstResize.disconnect).toHaveBeenCalled();
    width.mockClear(); o.resize(600, firstResize); expect(width).not.toHaveBeenCalled();
    o.enter(); expect(o.resizes).toHaveLength(2);
    unmount(); expect(o.resizes[1].disconnect).toHaveBeenCalled();
  });

  it("keeps carousel resize updates and removes fallback listeners without ResizeObserver", () => {
    const o = observers(); vi.stubGlobal("ResizeObserver", undefined);
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get");
    const { unmount } = render(<WhyCarousel cards={cards} />);
    expect(width).not.toHaveBeenCalled(); o.enter(); expect(width).toHaveBeenCalled();
    width.mockClear(); fireEvent(window, new Event("resize")); expect(width).toHaveBeenCalled();
    unmount(); width.mockClear(); fireEvent(window, new Event("resize")); expect(width).not.toHaveBeenCalled();
  });
});

describe("Intl work is reused without changing output", () => {
  it("shares one grapheme segmenter across words, rerenders and instances while preserving graphemes and timing", () => {
    const constructor = vi.spyOn(Intl, "Segmenter");
    const { container, rerender } = render(<KineticText text={"Lâm 👩‍💻"} staggerMs={30} />);
    expect(constructor).toHaveBeenCalledTimes(1);
    expect([...container.querySelectorAll("[data-char]")].map((n) => n.textContent)).toEqual(["L", "â", "m", " ", "👩‍💻"]);
    expect(container.querySelectorAll<HTMLElement>("[data-char]")[4].style.animationDelay).toBe("120ms");
    rerender(<><KineticText text="Another name" /><KineticText text="日本語" /></>);
    expect(constructor).toHaveBeenCalledTimes(1);
  });

  it("retains the code-point fallback without Intl.Segmenter", () => {
    vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });
    const { container } = render(<KineticText text="A😀" />);
    expect([...container.querySelectorAll("[data-char]")].map((n) => n.textContent)).toEqual(["A", "😀"]);
  });

  it("reuses timezone formatters and fixed placeholders across instances and ticks, keeping live time and SSR widths", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-13T07:32:00Z"));
    const NativeFormatter = Intl.DateTimeFormat;
    const dates: number[] = [];
    const constructor = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
      const formatter = new NativeFormatter(...args);
      const format = formatter.formatToParts.bind(formatter);
      formatter.formatToParts = (date) => { dates.push(Number(date)); return format(date); };
      return formatter;
    });
    expect(renderToString(<LocalTime />)).toContain("min-width:13ch");
    const placeholderCalls = dates.filter((date) => date === Date.UTC(2026, 0, 1));
    expect(placeholderCalls).toHaveLength(1);
    render(<><LocalTime /><LocalTime /></>);
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("14:32 (GMT+7)")).toHaveLength(2);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getAllByText("14:33 (GMT+7)")).toHaveLength(2);
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(dates.filter((date) => date === Date.UTC(2026, 0, 1))).toHaveLength(1);
    cleanup(); expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds timezone cache growth and refreshes timezone-specific labels when props change", () => {
    const constructor = vi.spyOn(Intl, "DateTimeFormat");
    const zones = Array.from({ length: 20 }, (_, i) => `Etc/GMT${i < 10 ? '+' : '-'}${i % 10 + 1}`);
    const { rerender } = render(<LocalTime timeZone={zones[0]} />);
    for (const zone of zones.slice(1)) rerender(<LocalTime timeZone={zone} />);
    expect(constructor).toHaveBeenCalledTimes(20);
    rerender(<LocalTime timeZone={zones[0]} />);
    expect(constructor).toHaveBeenCalledTimes(21);
    expect(screen.getByText(/\(GMT-1\)$/)).toBeInTheDocument();
  });
});
