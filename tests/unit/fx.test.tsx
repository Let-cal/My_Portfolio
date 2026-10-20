import { renderToString } from "react-dom/server";
import { Profiler } from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GlowCard } from "@/components/fx/GlowCard";
import { GrainOverlay } from "@/components/fx/GrainOverlay";
import { KineticText } from "@/components/fx/KineticText";
import { LocalTime } from "@/components/fx/LocalTime";
import { MagneticButton } from "@/components/fx/MagneticButton";
import { Marquee } from "@/components/fx/Marquee";
import { NumberTicker } from "@/components/fx/NumberTicker";
import {
  SCROLL_REVEAL_MIN_OPACITY,
  ScrollTextReveal,
} from "@/components/fx/ScrollTextReveal";
import { Spotlight } from "@/components/fx/Spotlight";
import { TextScramble } from "@/components/fx/TextScramble";
import { WaveEdge } from "@/components/fx/WaveEdge";
import { useSound } from "@/components/fx/sound";
import { usePointerFine } from "@/components/fx/use-pointer-fine";

/** matchMedia stub: `matches` decides per query string. */
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
const reduced = (q: string) => q.includes("prefers-reduced-motion");
const pointerFine = (q: string) => q.includes("pointer: fine");

class FakeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("usePointerFine", () => {
  it("is true only when the device hovers with a fine pointer", () => {
    stubMedia(pointerFine);
    expect(renderHook(() => usePointerFine()).result.current).toBe(true);
    stubMedia(() => false);
    expect(renderHook(() => usePointerFine()).result.current).toBe(false);
  });

  it("is false when matchMedia is unavailable", () => {
    expect(renderHook(() => usePointerFine()).result.current).toBe(false);
  });
});

describe("NumberTicker", () => {
  it("defers the prepared ticker formatter until its first visible animation frame", () => {
    stubMedia(() => false);
    let trigger: IntersectionObserverCallback = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class extends FakeObserver {
        constructor(callback: IntersectionObserverCallback) {
          super();
          trigger = callback;
        }
      },
    );
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const constructor = vi.spyOn(Intl, "NumberFormat");
    try {
      render(<NumberTicker value={1.234567} formattedValue="1.234567" />);
      expect(constructor).not.toHaveBeenCalled();
      expect(
        screen.getByLabelText("1.234567").querySelector("[data-ticker-value]"),
      ).toHaveTextContent("0.000000");
      act(() =>
        trigger(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        ),
      );
      expect(constructor).toHaveBeenCalledTimes(1);
    } finally {
      constructor.mockRestore();
    }
  });
  it("counts without scheduling React renders on animation frames", () => {
    stubMedia(() => false);
    vi.useFakeTimers();
    let trigger: IntersectionObserverCallback = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class extends FakeObserver {
        constructor(callback: IntersectionObserverCallback) {
          super();
          trigger = callback;
        }
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    const commits = vi.fn();
    render(
      <Profiler id="ticker" onRender={commits}>
        <NumberTicker value={100} durationMs={1000} />
      </Profiler>,
    );
    commits.mockClear();
    act(() =>
      trigger(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(
      screen.getByLabelText("100").querySelector("[data-ticker-value]"),
    ).toHaveTextContent("100");
    expect(commits).not.toHaveBeenCalled();
  });
  it("shows the final value immediately under reduced motion", () => {
    stubMedia(reduced);
    render(<NumberTicker value={14} />);
    expect(
      screen.getByLabelText("14").querySelector("[data-ticker-value]")
        ?.textContent,
    ).toBe("14");
  });

  it("keeps the final text (with prefix and suffix) in the accessible label while counting", () => {
    stubMedia(() => false);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<NumberTicker value={1200} prefix="~" suffix="+" />);
    expect(screen.getByLabelText("~1,200+")).toBeInTheDocument();
  });

  it("counts up to the final value once it enters the viewport", () => {
    stubMedia(() => false);
    vi.useFakeTimers();
    let trigger: IntersectionObserverCallback = () => {};
    class IO extends FakeObserver {
      constructor(cb: IntersectionObserverCallback) {
        super();
        trigger = cb;
      }
    }
    vi.stubGlobal("IntersectionObserver", IO);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    render(<NumberTicker value={14} durationMs={1000} />);
    const shown = () =>
      screen.getByLabelText("14").querySelector("[data-ticker-value]")
        ?.textContent;
    expect(shown()).toBe("0");
    // Width is reserved by the invisible final text, so counting 0 -> 14 never changes the box.
    expect(
      screen.getByLabelText("14").querySelector("[data-ticker-reserve]")
        ?.textContent,
    ).toBe("14");
    act(() =>
      trigger(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(shown()).toBe("14");
  });

  it("reserves the width of the final text (prefix, commas, suffix) with an invisible element", () => {
    stubMedia(() => false);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<NumberTicker value={1200} prefix="~" suffix="+" />);
    const root = screen.getByLabelText("~1,200+");
    const reserve = root.querySelector("[data-ticker-reserve]");
    expect(reserve).toHaveTextContent("~1,200+");
    expect(reserve).toHaveClass("invisible");
    expect(reserve).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveClass("inline-grid");
    // Counting text sits in the same grid cell as the reserve, so it overlays instead of adding width.
    expect(root.querySelector("[data-ticker-value]")).toHaveClass(
      "col-start-1",
      "row-start-1",
    );
  });
});

describe("KineticText", () => {
  it("renders one aria-hidden span per character plus the full sr-only text", () => {
    render(<KineticText text="Le Tran Cat Lam" />);
    const chars = document.querySelectorAll("[data-char]");
    expect(chars).toHaveLength(15);
    chars.forEach((c) => expect(c).toHaveAttribute("aria-hidden", "true"));
    expect(screen.getByText("Le Tran Cat Lam")).toHaveClass("sr-only");
  });

  it("leaves Japanese text flat so it can wrap between characters", () => {
    const { container } = render(
      <KineticText text="フルスタックエンジニアのポートフォリオ" />,
    );
    expect(container.querySelector(".whitespace-nowrap")).toBeNull();
    expect(document.querySelectorAll("[data-char]")).toHaveLength(
      Array.from("フルスタックエンジニアのポートフォリオ").length,
    );
  });

  it("keeps decomposed Vietnamese diacritics attached to their letter", () => {
    const { container } = render(<KineticText text={"Lâm"} />);
    const chars = Array.from(container.querySelectorAll("[data-char]"));
    expect(chars).toHaveLength(3);
    expect(chars[1]?.textContent).toBe("â");
  });

  it("still groups space-separated words so lines break only between words", () => {
    const { container } = render(<KineticText text="Le Tran" />);
    expect(container.querySelectorAll(".whitespace-nowrap")).toHaveLength(2);
  });

  it("keeps each space inside the word group before it, so a wrapped line never starts with a blank", () => {
    const { container } = render(<KineticText text="Let us build" />);
    const groups = Array.from(container.querySelectorAll(".whitespace-nowrap"));
    expect(groups.map((g) => g.textContent)).toEqual(["Let ", "us ", "build"]);
    expect(Array.from(container.querySelectorAll("[data-char]"))).toHaveLength(
      "Let us build".length,
    );
    container
      .querySelectorAll(".whitespace-pre")
      .forEach((sp) => expect(sp.closest(".whitespace-nowrap")).not.toBeNull());
  });

  it("renders the requested heading level", () => {
    render(<KineticText as="h1" text="Hi" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Hi" }),
    ).toBeInTheDocument();
  });
});

describe("Marquee", () => {
  it("renders the content twice and hides the copy from assistive tech", () => {
    stubMedia(() => false);
    render(
      <Marquee>
        <span>React</span>
      </Marquee>,
    );
    const all = screen.getAllByText("React");
    expect(all).toHaveLength(2);
    expect(all[0]?.closest("[aria-hidden]")).toBeNull();
    expect(all[1]?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("shows a single copy under reduced motion", () => {
    stubMedia(reduced);
    render(
      <Marquee>
        <span>React</span>
      </Marquee>,
    );
    expect(screen.getAllByText("React")).toHaveLength(1);
  });
});

describe("TextScramble", () => {
  beforeEach(() => vi.useFakeTimers());

  it("scrambles on change and settles on the new text after durationMs", () => {
    stubMedia(() => false);
    const { container, rerender } = render(
      <TextScramble text="Fullstack" durationMs={500} />,
    );
    const visible = () =>
      container.querySelector("[aria-hidden='true']")?.textContent;
    expect(visible()).toBe("Fullstack");
    rerender(<TextScramble text="Tech Lead" durationMs={500} />);
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(visible()).not.toBe("Tech Lead");
    expect(visible()).toHaveLength("Tech Lead".length);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(visible()).toBe("Tech Lead");
    expect(
      screen.getByText("Tech Lead", { selector: ".sr-only" }),
    ).toBeInTheDocument();
  });

  it("swaps instantly under reduced motion", () => {
    stubMedia(reduced);
    const { container, rerender } = render(<TextScramble text="A" />);
    rerender(<TextScramble text="B" />);
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe(
      "B",
    );
  });
});

describe("LocalTime", () => {
  it("shows the time in Ho Chi Minh as HH:mm (GMT+7)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T07:32:00Z"));
    render(<LocalTime timeZone="Asia/Ho_Chi_Minh" />);
    expect(screen.getByText("14:32 (GMT+7)")).toBeInTheDocument();
  });

  it("server render uses a placeholder with the same shape as the real label", () => {
    const html = renderToString(<LocalTime timeZone="Asia/Ho_Chi_Minh" />);
    expect(html).toContain("--:-- (GMT+7)");
    expect(html).toContain("min-width:13ch");
  });

  it("refreshes every 30 seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T07:32:00Z"));
    render(<LocalTime />);
    act(() => {
      vi.advanceTimersByTime(30_000 * 2);
    });
    expect(screen.getByText("14:33 (GMT+7)")).toBeInTheDocument();
  });
});

describe("MagneticButton", () => {
  it("sets no transform when the pointer is not fine", () => {
    stubMedia(() => false);
    render(<MagneticButton>Go</MagneticButton>);
    const btn = screen.getByRole("button", { name: "Go" });
    fireEvent.pointerMove(btn, { clientX: 40, clientY: 40 });
    expect(btn.style.transform).toBe("");
    expect(btn.getAttribute("style") ?? "").not.toContain("transform");
  });

  it("renders its child instead of a button with asChild", () => {
    stubMedia(() => false);
    render(
      <MagneticButton asChild>
        <a href="https://example.com/x">Link</a>
      </MagneticButton>,
    );
    expect(screen.getByRole("link", { name: "Link" })).toHaveAttribute(
      "href",
      "https://example.com/x",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Spotlight / GrainOverlay / WaveEdge / GlowCard", () => {
  it("Spotlight renders nothing without a fine pointer, and a fixed layer with one", () => {
    stubMedia(() => false);
    const { container, unmount } = render(<Spotlight />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    stubMedia(pointerFine);
    const r = render(<Spotlight />);
    const layer = r.container.firstElementChild as HTMLElement;
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer.className).toContain("fixed");
    expect(layer.className).toContain("pointer-events-none");
    expect(layer.style.background || layer.style.backgroundImage).toContain(
      "600px circle",
    );
  });

  it("GrainOverlay is a decorative, click-through fixed layer with configurable opacity", () => {
    const { container } = render(<GrainOverlay opacity={0.1} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.className).toContain("pointer-events-none");
    expect(el.className).toContain("fixed");
    expect(el.style.opacity).toBe("0.1");
    expect(el.style.backgroundImage).toContain("feTurbulence");
  });

  it("WaveEdge is a 48px decorative SVG and can be flipped", () => {
    const { container, rerender } = render(<WaveEdge />);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap).toHaveAttribute("aria-hidden", "true");
    expect(wrap.querySelector("svg")).not.toBeNull();
    expect(wrap.className).toContain("h-12");
    expect(wrap.className).not.toContain("-scale-y-100");
    rerender(<WaveEdge flip />);
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "-scale-y-100",
    );
  });

  it("GlowCard exposes data-glow-card and ignores the pointer on touch devices", () => {
    stubMedia(() => false);
    render(
      <GlowCard tilt className="x">
        card
      </GlowCard>,
    );
    const card = screen.getByText("card");
    expect(card).toHaveAttribute("data-glow-card");
    expect(card).toHaveClass("x");
    fireEvent.pointerMove(card, { clientX: 5, clientY: 5 });
    expect(card.getAttribute("style") ?? "").not.toContain("--gx");
  });

  it("GlowCard tracks the pointer into --gx/--gy on fine pointers", () => {
    stubMedia(pointerFine);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    render(<GlowCard tilt>card</GlowCard>);
    const card = screen.getByText("card");
    fireEvent.pointerMove(card, {
      clientX: 5,
      clientY: 7,
      pointerType: "mouse",
    });
    expect(card.style.getPropertyValue("--gx")).toBe("5px");
    expect(card.style.getPropertyValue("--gy")).toBe("7px");
    fireEvent.pointerLeave(card);
    expect(card.style.getPropertyValue("--tilt-x")).toBe("0deg");
  });
});

describe("ScrollTextReveal", () => {
  it("renders every word", () => {
    stubMedia(() => false);
    vi.stubGlobal("ResizeObserver", FakeObserver);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<ScrollTextReveal text="I build things for the web" />);
    for (const w of ["I", "build", "things", "for", "the", "web"]) {
      expect(screen.getByText(w)).toBeInTheDocument();
    }
  });

  it("reveals unspaced Japanese text in several segments, not as one block", () => {
    stubMedia(() => false);
    vi.stubGlobal("ResizeObserver", FakeObserver);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const ja = "日本のお客様の要望を、要件定義から設計、実装まで形にします。";
    const { container } = render(<ScrollTextReveal text={ja} locale="ja" />);
    const units = container.querySelectorAll("[data-reveal-unit]");
    expect(units.length).toBeGreaterThan(5);
    expect(
      Array.from(units)
        .map((u) => u.textContent)
        .join(""),
    ).toBe(ja);
  });

  it("keeps the whole sentence for screen readers exactly once, and hides the dimmed words from them", () => {
    stubMedia(() => false);
    vi.stubGlobal("ResizeObserver", FakeObserver);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const { container } = render(
      <ScrollTextReveal text="I build things for the web" />,
    );
    const sr = container.querySelectorAll(".sr-only");
    expect(sr).toHaveLength(1);
    expect(sr[0].textContent).toBe("I build things for the web");
    expect(
      container
        .querySelector("[aria-hidden='true']")
        ?.querySelectorAll("[data-reveal-unit]"),
    ).toHaveLength(6);
  });

  it("shows every word at full opacity when motion is reduced", () => {
    stubMedia(reduced);
    vi.stubGlobal("ResizeObserver", FakeObserver);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const { container } = render(
      <ScrollTextReveal text="I build things for the web" />,
    );
    const units = Array.from(
      container.querySelectorAll<HTMLElement>("[data-reveal-unit]"),
    );
    expect(units).toHaveLength(6);
    for (const u of units) expect(u.style.opacity).toBe("1");
  });

  it("never dims a word below 0.3 opacity", () => {
    expect(SCROLL_REVEAL_MIN_OPACITY).toBeGreaterThanOrEqual(0.3);
  });
});

describe("useSound", () => {
  it("defaults to off and persists the choice in localStorage['sound']", () => {
    const { result } = renderHook(() => useSound());
    expect(result.current.enabled).toBe(false);
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(window.localStorage.getItem("sound")).toBe("on");
    act(() => result.current.setEnabled(false));
    expect(window.localStorage.getItem("sound")).toBe("off");
  });
});
