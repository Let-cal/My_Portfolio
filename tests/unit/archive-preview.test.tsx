import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchivePreview } from "@/components/sections/projects/ArchivePreview";

/** A manual requestAnimationFrame: callbacks wait in a queue until `step` runs them. */
let queue: FrameRequestCallback[] = [];
let calls = 0;
function step() {
  const now = queue;
  queue = [];
  for (const cb of now) cb(0);
}
/** Runs frames until none is scheduled (bounded, so a loop that never settles fails instead of hanging). */
function settle(max = 500) {
  let frames = 0;
  while (queue.length > 0 && frames < max) {
    step();
    frames += 1;
  }
  return frames;
}

const rect = (top: number) =>
  ({
    top,
    bottom: top + 60,
    left: 100,
    right: 700,
    width: 600,
    height: 60,
    x: 100,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

let root: HTMLElement;
let row: HTMLElement;
let button: HTMLButtonElement;
let rowTop = 200;

beforeEach(() => {
  queue = [];
  calls = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    calls += 1;
    queue.push(cb);
    return calls;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  root = document.createElement("div");
  row = document.createElement("li");
  row.id = "row-coa";
  row.setAttribute("data-archive-kind", "work");
  button = document.createElement("button");
  button.textContent = "COA";
  row.append(button);
  root.append(row);
  document.body.append(root);
  rowTop = 200;
  vi.spyOn(row, "getBoundingClientRect").mockImplementation(() => rect(rowTop));
  // jsdom has no keyboard modality: treat this button as :focus-visible (only this element is stubbed).
  const matches = button.matches.bind(button);
  vi.spyOn(button, "matches").mockImplementation((selector: string) =>
    selector === ":focus-visible" ? true : matches(selector),
  );
  observers = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      targets: Element[] = [];
      constructor(public cb: ResizeObserverCallback) {
        observers.push(this);
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      unobserve() {}
      disconnect() {
        this.targets = [];
      }
    },
  );
});

type FakeObserver = { cb: ResizeObserverCallback; targets: Element[] };
let observers: FakeObserver[] = [];
/** Reports a size change of every element an observer still watches. */
const resized = () => {
  for (const o of observers)
    if (o.targets.length) o.cb([], o as unknown as ResizeObserver);
};
afterEach(() => {
  root.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const card = () =>
  document.querySelector<HTMLElement>("[data-archive-preview]")!;

describe("ArchivePreview", () => {
  it("anchored by keyboard focus, it stops scheduling frames once settled and re-aims once per scroll", () => {
    render(
      <ArchivePreview
        root={root}
        items={{ coa: { title: "COA", posterUrl: null } }}
      />,
    );
    act(() => {
      button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(card()).toHaveAttribute("data-on", "");
    expect(card()).toHaveTextContent("COA");

    act(() => {
      expect(settle()).toBeLessThan(500);
    });
    // Settled under the row's right edge: 700 - 220, below the row (200 + 60 + 8).
    expect(card().style.transform).toBe("translate3d(480px, 268px, 0)");
    const after = calls;
    // No scroll, no resize: nothing more is scheduled, however long the row keeps focus.
    act(() => step());
    expect(queue).toHaveLength(0);
    expect(calls).toBe(after);

    // The page scrolls by 100px: one frame re-aims, then it eases there and stops again.
    rowTop = 100;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
    });
    expect(calls).toBe(after + 1);
    act(() => {
      expect(settle()).toBeLessThan(500);
    });
    expect(card().style.transform).toMatch(
      /^translate3d\(480px, 168\.\d+px, 0\)$/,
    );
    expect(queue).toHaveLength(0);
  });

  it("anchored, it re-aims when the rows move without a scroll (a filter change, a late font)", () => {
    render(
      <ArchivePreview
        root={root}
        items={{ coa: { title: "COA", posterUrl: null } }}
      />,
    );
    act(() => {
      button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      settle();
    });
    expect(card().style.transform).toBe("translate3d(480px, 268px, 0)");
    const after = calls;
    // The rows above shrink: the focused row moves up 100px and the list's box changes size.
    rowTop = 100;
    act(() => resized());
    expect(calls).toBe(after + 1);
    act(() => {
      expect(settle()).toBeLessThan(500);
    });
    expect(card().style.transform).toMatch(
      /^translate3d\(480px, 168\.\d+px, 0\)$/,
    );
  });

  it("a scroll after the focus leaves the row schedules nothing", () => {
    const other = document.createElement("button");
    document.body.append(other);
    render(
      <ArchivePreview
        root={root}
        items={{ coa: { title: "COA", posterUrl: null } }}
      />,
    );
    act(() => {
      button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      settle();
    });
    act(() => {
      button.dispatchEvent(
        new FocusEvent("focusout", { bubbles: true, relatedTarget: other }),
      );
    });
    expect(card()).not.toHaveAttribute("data-on");
    const after = calls;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("resize"));
      resized();
    });
    expect(calls).toBe(after);
    other.remove();
  });
});
