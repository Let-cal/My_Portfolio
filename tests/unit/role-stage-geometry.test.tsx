import { act, cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { StrictMode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { RoleStage } from "@/components/sections/hero/RoleStage";
import en from "@/messages/en.json";

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRectReadOnly {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

class Observer {
  static instances: Observer[] = [];
  targets = new Set<Element>();
  observe = vi.fn((target: Element) => {
    this.targets.add(target);
  });
  unobserve = vi.fn((target: Element) => {
    this.targets.delete(target);
  });
  disconnect = vi.fn(() => {
    this.targets.clear();
  });
  constructor(readonly callback: ResizeObserverCallback) {
    Observer.instances.push(this);
  }
  emit(entries: ResizeObserverEntry[]) {
    act(() => this.callback(entries, this as unknown as ResizeObserver));
  }
}

function entry(
  target: Element,
  width: number,
  shape: "array" | "object" | "content" = "array",
): ResizeObserverEntry {
  const size = { inlineSize: width, blockSize: 700 };
  return {
    target,
    contentRect: rect(0, 0, width, 700),
    contentBoxSize: [size],
    devicePixelContentBoxSize: [size],
    borderBoxSize: shape === "array" ? [size] : shape === "object" ? size : [],
  } as unknown as ResizeObserverEntry;
}

function mount(strict = false) {
  const view = (
    <NextIntlClientProvider locale="en" messages={en}>
      <div className="hero-stage-wrap">
        <RoleStage />
      </div>
    </NextIntlClientProvider>
  );
  const result = render(strict ? <StrictMode>{view}</StrictMode> : view);
  const stage = result.container.querySelector<HTMLElement>(".hero-stage")!;
  const panels = [...stage.querySelectorAll<HTMLElement>("[data-panel]")];
  return { ...result, stage, panels, observer: Observer.instances.at(-1)! };
}

let stageWidth: number, stageHeight: number, leftPanelWidth: number;
let bounds: MockInstance<Element["getBoundingClientRect"]>;

beforeEach(() => {
  Observer.instances = [];
  vi.stubGlobal("ResizeObserver", Observer);
  vi.stubGlobal("innerWidth", 1600);
  document.documentElement.style.fontSize = "16px";
  stageWidth = 1000;
  stageHeight = 700;
  leftPanelWidth = 250;
  bounds = vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      if (this.matches(".hero-stage"))
        return rect(10, 20, stageWidth, stageHeight);
      if (this.matches("[data-role-wheel]")) return rect(300, 40, 440, 440);
      if (this.matches("[data-panel='fullstack']"))
        return rect(0, 100, leftPanelWidth, 160);
      if (this.matches("[data-panel='techlead']"))
        return rect(750, 100, 250, 160);
      return rect(300, 550, 400, 150);
    });
});

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("font-size");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("RoleStage leader geometry", () => {
  it.each(["array", "object", "content"] as const)(
    "uses the %s observer width without mobile bounds reads, even in a wide viewport",
    (shape) => {
      const { container, stage, panels, observer } = mount();
      expect(bounds).not.toHaveBeenCalled();
      observer.emit([entry(stage, 412, shape)]);
      expect(bounds).not.toHaveBeenCalled();
      expect(container.querySelector(".hero-lines")).toBeNull();
      expect([...observer.targets]).toEqual([stage]);
      // A queued panel notification must not activate hidden geometry work.
      observer.emit([entry(panels[0], 250)]);
      expect(bounds).not.toHaveBeenCalled();
      observer.emit([entry(stage, 832, shape)]);
      expect(container.querySelector(".hero-lines")).toHaveAttribute(
        "viewBox",
        "0 0 1000 700",
      );
    },
  );

  it("keeps the 52rem boundary inclusive and follows the root font, not the stage font or viewport", () => {
    document.documentElement.style.fontSize = "20px";
    const { container, stage, observer } = mount();
    stage.style.fontSize = "32px";
    observer.emit([entry(stage, 1039)]);
    expect(bounds).not.toHaveBeenCalled();
    expect(container.querySelector(".hero-lines")).toBeNull();
    observer.emit([entry(stage, 1040)]);
    expect(container.querySelector(".hero-lines")).not.toBeNull();
  });

  it("retains desktop stage and panel resize geometry", () => {
    const { container, stage, panels, observer } = mount();
    observer.emit([entry(stage, 1000)]);
    expect(bounds).toHaveBeenCalledTimes(5);
    expect([...observer.targets]).toEqual([stage, ...panels]);
    expect(container.querySelector(".hero-lines")).toHaveAttribute(
      "viewBox",
      "0 0 1000 700",
    );
    expect(
      container.querySelector(".hero-lines g[data-on] circle:last-child"),
    ).toHaveAttribute("cx", "254");
    expect(
      container.querySelector(".hero-lines g[data-on] circle:last-child"),
    ).toHaveAttribute("cy", "98");
    leftPanelWidth = 270;
    observer.emit([entry(panels[0], 270)]);
    expect(
      container.querySelector(".hero-lines g[data-on] circle:last-child"),
    ).toHaveAttribute("cx", "274");
    stageWidth = 1100;
    stageHeight = 750;
    observer.emit([entry(stage, 1100)]);
    expect(container.querySelector(".hero-lines")).toHaveAttribute(
      "viewBox",
      "0 0 1100 750",
    );
  });

  it("stops mobile measurements after shrinking and resumes fresh geometry when widened again", () => {
    const { container, stage, panels, observer } = mount();
    observer.emit([entry(stage, 1000)]);
    bounds.mockClear();
    observer.emit([entry(panels[0], 250), entry(stage, 831)]);
    expect(bounds).not.toHaveBeenCalled();
    expect(container.querySelector(".hero-lines")).toBeNull();
    expect([...observer.targets]).toEqual([stage]);
    observer.emit([entry(panels[1], 250)]);
    expect(bounds).not.toHaveBeenCalled();
    stageWidth = 950;
    observer.emit([entry(stage, 950)]);
    expect(container.querySelector(".hero-lines")).toHaveAttribute(
      "viewBox",
      "0 0 950 700",
    );
    expect([...observer.targets]).toEqual([stage, ...panels]);
  });

  it("rechecks the rem threshold when a font change resizes the stage", () => {
    const { container, stage, observer } = mount();
    observer.emit([entry(stage, 1000)]);
    document.documentElement.style.fontSize = "20px";
    bounds.mockClear();
    observer.emit([entry(stage, 1000)]);
    expect(bounds).not.toHaveBeenCalled();
    expect(container.querySelector(".hero-lines")).toBeNull();
  });

  it("disconnects and ignores queued notifications after unmount or StrictMode replay", () => {
    const { stage, observer, unmount } = mount(true);
    const stale = Observer.instances[0];
    expect(stale.disconnect).toHaveBeenCalled();
    stale.emit([entry(stage, 1000)]);
    expect(bounds).not.toHaveBeenCalled();
    observer.emit([entry(stage, 1000)]);
    expect(bounds).toHaveBeenCalledTimes(5);
    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
    bounds.mockClear();
    observer.emit([entry(stage, 1000)]);
    expect(bounds).not.toHaveBeenCalled();
  });

  it("retains the existing no-ResizeObserver fallback without geometry reads", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const { container } = mount();
    expect(bounds).not.toHaveBeenCalled();
    expect(container.querySelector(".hero-lines")).toBeNull();
  });
});
