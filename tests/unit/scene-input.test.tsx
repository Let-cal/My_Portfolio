import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sceneStore } from "@/scene/store";
import { measureAvoid, useAvoidTracking, useCtaTracking, useFeedClicks } from "@/scene/use-scene-input";

function rect(x0: number, y0: number, x1: number, y1: number): DOMRect {
  return { left: x0, top: y0, right: x1, bottom: y1, x: x0, y: y0, width: x1 - x0, height: y1 - y0, toJSON: () => ({}) } as DOMRect;
}

/** Gives an element a layout box (jsdom has none). */
function box(el: Element, r: DOMRect) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue(r);
}

function define(key: "innerWidth" | "innerHeight", value: number) {
  Object.defineProperty(window, key, { value, configurable: true });
}

function FeedProbe({ on = true }: { on?: boolean }) {
  useFeedClicks(on);
  return null;
}
function AvoidProbe() {
  useAvoidTracking(true);
  return null;
}

beforeEach(() => {
  sceneStore.reset();
  define("innerWidth", 1000);
  define("innerHeight", 800);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("useFeedClicks", () => {
  function water() {
    document.body.innerHTML = `<div id="stage"><div data-water-zone="" id="zone"></div><button id="btn">role</button><div data-role-wheel="" id="wheel"></div><p id="other">text</p></div>`;
    box(document.getElementById("zone")!, rect(100, 100, 900, 500));
    return {
      stage: document.getElementById("stage")!,
      btn: document.getElementById("btn")!,
      wheel: document.getElementById("wheel")!,
      other: document.getElementById("other")!,
    };
  }
  const click = (target: Element, x: number, y: number) =>
    act(() => void target.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y, button: 0 })));

  it("turns a click on the water into a drop request in normalised device coordinates", () => {
    const { stage } = water();
    render(<FeedProbe />);
    click(stage, 750, 200);
    // x: 750 of 1000 is +0.5; y: 200 of 800 is 0.25 down from the top, so +0.5 up.
    expect(sceneStore.getState().drop).toMatchObject({ x: 0.5, y: 0.5 });
  });

  it("gives every click its own id, so two clicks on the same spot both drop food", () => {
    const { stage } = water();
    render(<FeedProbe />);
    click(stage, 400, 300);
    const first = sceneStore.getState().drop!.id;
    click(stage, 400, 300);
    expect(sceneStore.getState().drop!.id).toBeGreaterThan(first);
  });

  it("ignores clicks outside the water zone", () => {
    const { other } = water();
    render(<FeedProbe />);
    click(other, 50, 50);
    click(other, 950, 650);
    expect(sceneStore.getState().drop).toBeNull();
  });

  it("leaves buttons, links and the role wheel to do their own job", () => {
    const { btn, wheel } = water();
    render(<FeedProbe />);
    click(btn, 400, 300);
    click(wheel, 400, 300);
    expect(sceneStore.getState().drop).toBeNull();
  });

  it.each(["p", "h2", "span"])("does not feed the koi when clicking %s text over the water", (tag) => {
    const { stage } = water();
    const text = document.createElement(tag);
    text.textContent = "Readable portfolio content";
    stage.appendChild(text);
    render(<FeedProbe />);
    click(text, 400, 300);
    expect(sceneStore.getState().drop).toBeNull();
  });

  it("does nothing while the scene is off, and stops listening when unmounted", () => {
    const { stage } = water();
    const { rerender, unmount } = render(<FeedProbe on={false} />);
    click(stage, 400, 300);
    expect(sceneStore.getState().drop).toBeNull();
    rerender(<FeedProbe on />);
    click(stage, 400, 300);
    expect(sceneStore.getState().drop).not.toBeNull();
    unmount();
    sceneStore.setState({ drop: null });
    click(stage, 400, 300);
    expect(sceneStore.getState().drop).toBeNull();
  });
});

describe("measureAvoid", () => {
  it("clips a translated carousel card to its overflow viewport before protecting it", () => {
    document.body.innerHTML = '<main><div id="viewport" style="overflow-x:clip"><article id="card" data-scene-avoid="box">card</article></div></main>';
    box(document.getElementById("viewport")!, rect(450, 150, 950, 650));
    box(document.getElementById("card")!, rect(100, 200, 500, 600));
    expect(measureAvoid()).toMatchObject([{ x0: 450, y0: 200, x1: 500, y1: 600 }]);
  });

  it("keeps an opaque card as a creature exclusion without adding veils over it or its children", () => {
    document.body.innerHTML = '<main><article id="card" data-scene-avoid="box" data-scene-veil="off"><p id="copy">text</p></article></main>';
    box(document.getElementById("card")!, rect(500, 200, 800, 700));
    box(document.getElementById("copy")!, rect(520, 600, 780, 680));
    expect(measureAvoid()).toMatchObject([{ x0: 500, y0: 200, x1: 800, y1: 700, veil: false }]);
    expect(measureAvoid()).toHaveLength(1);
  });

  it("ignores decorative hidden ticker copies even when they extend across the screen", () => {
    document.body.innerHTML = '<main><div aria-hidden="true"><p id="copy">decorative name repeat</p></div></main>';
    box(document.getElementById("copy")!, rect(-2000, 100, 3000, 200));
    expect(measureAvoid()).toEqual([]);
  });
  beforeEach(() => {
    // jsdom has no Range geometry: a range reports the box its element was given.
    vi.spyOn(Range.prototype, "selectNodeContents").mockImplementation(function (this: Range, node: Node) {
      (this as unknown as { __node: Node }).__node = node;
    });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value(this: Range) {
        return (this as unknown as { __node: Element }).__node.getBoundingClientRect();
      },
    });
  });

  afterEach(() => {
    delete (Range.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
  });

  it("leaves out anything inside a [data-scene-ignore] element, such as the solid round call to action", () => {
    document.body.innerHTML = `<main>
      <h2 id="h">Heading</h2>
      <a id="cta" data-scene-ignore="" href="#x"><span id="label">Get in touch</span></a>
    </main>`;
    box(document.getElementById("h")!, rect(100, 100, 300, 140));
    box(document.getElementById("cta")!, rect(800, 300, 960, 460));
    box(document.getElementById("label")!, rect(820, 360, 940, 400));
    expect(measureAvoid()).toMatchObject([{ x0: 100, y0: 100, x1: 300, y1: 140 }]);
  });

  it("collects marked text, glass cards and the page's own headings, near the screen only", () => {
    document.body.innerHTML = `<main>
      <h2 id="h">Heading</h2>
      <div id="card" class="rounded backdrop-blur-md">card</div>
      <p id="m" data-scene-avoid="">marked</p>
      <p id="far">far away</p>
      <p id="sr">hidden</p>
    </main>`;
    box(document.getElementById("h")!, rect(100, 100, 300, 140));
    box(document.getElementById("card")!, rect(100, 400, 700, 600));
    box(document.getElementById("m")!, rect(100, 700, 300, 740));
    box(document.getElementById("far")!, rect(100, 5000, 300, 5040));
    box(document.getElementById("sr")!, rect(0, 0, 1, 1));
    const rects = measureAvoid();
    // The three on screen survive (the card is merged with nothing: 100px away from the others), the far one and the 1px one do not.
    expect(rects).toHaveLength(3);
    expect(rects.some((r) => r.y0 === 400 && r.y1 === 600)).toBe(true);
    expect(rects.some((r) => r.y0 === 100 && r.y1 === 140)).toBe(true);
    expect(rects.some((r) => r.y0 === 700)).toBe(true);
    expect(rects.some((r) => r.y0 >= 5000)).toBe(false);
  });

  it("joins blocks that are close, so a row of chips is one block", () => {
    document.body.innerHTML = `<main><ul><li id="a">a</li><li id="b">b</li><li id="c">c</li></ul></main>`;
    box(document.getElementById("a")!, rect(100, 100, 160, 124));
    box(document.getElementById("b")!, rect(170, 100, 230, 124));
    box(document.getElementById("c")!, rect(240, 100, 300, 124));
    expect(measureAvoid()).toMatchObject([{ x0: 100, y0: 100, x1: 300, y1: 124 }]);
  });

  it("re-measures after a page transition, but not after the veil's own fade", async () => {
    document.body.innerHTML = `<main><h2 id="h">Heading</h2></main><div data-koi-veil=""><i id="panel"></i></div>`;
    box(document.getElementById("h")!, rect(100, 100, 300, 140));
    // Frames run a moment after they are requested, as in a browser.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      void Promise.resolve().then(() => cb(0));
      return 1;
    });
    const scan = vi.spyOn(document, "querySelectorAll");
    render(<AvoidProbe />);
    await act(async () => {});
    const mounted = scan.mock.calls.length;
    const fire = (el: Element) =>
      act(async () => {
        el.dispatchEvent(new Event("transitionend", { bubbles: true }));
      });
    await fire(document.getElementById("panel")!);
    expect(scan.mock.calls.length).toBe(mounted);
    await fire(document.getElementById("h")!);
    expect(scan.mock.calls.length).toBeGreaterThan(mounted);
    vi.unstubAllGlobals();
  });

  it("is written into the store on mount and cleared on unmount", () => {
    document.body.innerHTML = `<main><h2 id="h">Heading</h2></main>`;
    box(document.getElementById("h")!, rect(100, 100, 300, 140));
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const { unmount } = render(<AvoidProbe />);
    expect(sceneStore.getState().avoid).toMatchObject([{ x0: 100, y0: 100, x1: 300, y1: 140 }]);
    unmount();
    expect(sceneStore.getState().avoid).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe("useCtaTracking", () => {
  function CtaProbe() {
    useCtaTracking(true);
    return null;
  }
  function cta() {
    const a = document.createElement("a");
    a.id = "contact-core";
    document.body.appendChild(a);
    return a;
  }

  it("publishes the centre and radius of #contact-core, in viewport pixels, once the story is at the Why chapter", () => {
    const a = cta();
    box(a, rect(800, 300, 960, 460));
    sceneStore.setState({ chapter: 5 });
    render(<CtaProbe />);
    expect(sceneStore.getState().cta).toEqual({ x: 880, y: 380, r: 80 });
  });

  it("reads nothing before that, and starts as soon as the chapter is reached", () => {
    const a = cta();
    const spy = vi.spyOn(a, "getBoundingClientRect").mockReturnValue(rect(800, 300, 960, 460));
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
    sceneStore.setState({ chapter: 3 });
    render(<CtaProbe />);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(spy).not.toHaveBeenCalled();
        expect(sceneStore.getState().cta).toBeNull();
        act(() => sceneStore.setState({ chapter: 5 }));
        setTimeout(() => {
          expect(spy).toHaveBeenCalledTimes(1);
          expect(sceneStore.getState().cta).toEqual({ x: 880, y: 380, r: 80 });
          // Scrolled back up: it is cleared.
          act(() => sceneStore.setState({ chapter: 2 }));
          setTimeout(() => {
            expect(sceneStore.getState().cta).toBeNull();
            vi.unstubAllGlobals();
            resolve();
          }, 30);
        }, 30);
      }, 30),
    );
  });

  it("follows the button as the page scrolls, one read per frame", () => {
    const a = cta();
    const spy = vi.spyOn(a, "getBoundingClientRect").mockReturnValue(rect(800, 300, 960, 460));
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0));
    sceneStore.setState({ chapter: 6 });
    render(<CtaProbe />);
    spy.mockClear();
    spy.mockReturnValue(rect(800, 100, 960, 260));
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
    });
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(spy).toHaveBeenCalledTimes(1);
        expect(sceneStore.getState().cta).toEqual({ x: 880, y: 180, r: 80 });
        vi.unstubAllGlobals();
        resolve();
      }, 30),
    );
  });

  it("is null when the page has no such button", () => {
    sceneStore.setState({ chapter: 6 });
    render(<CtaProbe />);
    expect(sceneStore.getState().cta).toBeNull();
  });

  it("clears on unmount: set first, then unmounted, then null", () => {
    const a = cta();
    box(a, rect(800, 300, 960, 460));
    sceneStore.setState({ chapter: 6 });
    const { unmount } = render(<CtaProbe />);
    expect(sceneStore.getState().cta).toEqual({ x: 880, y: 380, r: 80 });
    unmount();
    expect(sceneStore.getState().cta).toBeNull();
  });

  it("does not write when nothing moved", () => {
    const a = cta();
    box(a, rect(800, 300, 960, 460));
    sceneStore.setState({ chapter: 6 });
    render(<CtaProbe />);
    const first = sceneStore.getState();
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(sceneStore.getState()).toBe(first);
  });
});
