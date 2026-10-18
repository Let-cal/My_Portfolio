import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sceneStore } from "@/scene/store";
import { useStaticChapterTracking } from "@/scene/use-static-chapter";

class Observer {
  static instances: Observer[] = [];
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(public callback: IntersectionObserverCallback, public options?: IntersectionObserverInit) {
    Observer.instances.push(this);
  }
  deliver(top = 200, height: number | null = 800, isIntersecting = false) {
    act(() => this.callback([{
      target: document.getElementById("why"),
      rootBounds: height === null ? null : { height },
      boundingClientRect: { top }, isIntersecting,
    } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver));
  }
}
function Probe({ enabled = true }: { enabled?: boolean }) {
  useStaticChapterTracking(enabled);
  return null;
}
let heightRead = vi.fn(() => 1000);
beforeEach(() => {
  sceneStore.reset();
  document.body.innerHTML = '<section id="why"></section>';
  Observer.instances = [];
  vi.stubGlobal("IntersectionObserver", Observer);
  heightRead = vi.fn(() => 1000);
  vi.spyOn(window, "innerHeight", "get").mockImplementation(heightRead);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ""; });

it("does not read viewport height or section geometry on supported IO startup", () => {
  const bounds = vi.spyOn(Element.prototype, "getBoundingClientRect");
  render(<Probe />);
  expect(heightRead).not.toHaveBeenCalled();
  expect(bounds).not.toHaveBeenCalled();
  expect(Observer.instances[0].options?.rootMargin).toBeUndefined();
});

it("uses bootstrap root bounds for the exact midpoint margin and preserves the dragon predicate", () => {
  render(<Probe />);
  const bootstrap = Observer.instances[0];
  bootstrap.deliver(600, 900, true);
  expect(sceneStore.getState().chapter).toBe(0);
  const midpoint = Observer.instances[1];
  expect(midpoint.options?.rootMargin).toBe("0px 0px -450px 0px");
  expect(bootstrap.disconnect).toHaveBeenCalled();
  expect(midpoint.observe).toHaveBeenCalledWith(document.getElementById("why"));
  midpoint.deliver(200, 450, true);
  expect(sceneStore.getState().chapter).toBe(5);
  midpoint.deliver(2000);
  expect(sceneStore.getState().chapter).toBe(0);
  midpoint.deliver(-2000);
  expect(sceneStore.getState().chapter).toBe(5);
  midpoint.deliver(0);
  expect(sceneStore.getState().chapter).toBe(0);
  expect(heightRead).not.toHaveBeenCalled();
});

it.each([-2000, 200])("resolves initial deep links at top %s from the midpoint delivery", (top) => {
  render(<Probe />);
  Observer.instances[0].deliver(top);
  Observer.instances[1].deliver(top, 400, top === 200);
  expect(sceneStore.getState().chapter).toBe(5);
});

it("reads viewport height only if bootstrap rootBounds is null", () => {
  render(<Probe />);
  expect(heightRead).not.toHaveBeenCalled();
  Observer.instances[0].deliver(200, null);
  expect(heightRead).toHaveBeenCalledTimes(1);
  expect(Observer.instances[1].options?.rootMargin).toBe("0px 0px -500px 0px");
  Observer.instances[1].deliver(-2000, null);
  expect(sceneStore.getState().chapter).toBe(5);
});

it("rebootstraps on resize and ignores stale bootstrap and midpoint deliveries", () => {
  render(<Probe />);
  const oldBootstrap = Observer.instances[0];
  act(() => window.dispatchEvent(new Event("resize")));
  oldBootstrap.deliver(200, null);
  expect(Observer.instances).toHaveLength(2);
  expect(heightRead).not.toHaveBeenCalled();
  const bootstrap = Observer.instances[1];
  bootstrap.deliver(200, 800);
  const oldMidpoint = Observer.instances[2];
  bootstrap.deliver(200, null);
  expect(Observer.instances).toHaveLength(3);
  act(() => window.dispatchEvent(new Event("resize")));
  oldMidpoint.deliver(-2000);
  expect(sceneStore.getState().chapter).toBe(0);
  Observer.instances[3].deliver(200, 1200);
  expect(Observer.instances[4].options?.rootMargin).toBe("0px 0px -600px 0px");
  expect(oldBootstrap.disconnect).toHaveBeenCalled();
  expect(oldMidpoint.disconnect).toHaveBeenCalled();
  expect(heightRead).not.toHaveBeenCalled();
});

it.each([false, true])("disposes during bootstrap or tracking (tracking=%s)", (tracking) => {
  const { unmount } = render(<Probe />);
  if (tracking) Observer.instances[0].deliver();
  const active = Observer.instances.at(-1)!;
  unmount();
  const count = Observer.instances.length;
  Observer.instances.forEach((observer) => observer.deliver(-2000, null));
  act(() => window.dispatchEvent(new Event("resize")));
  expect(active.disconnect).toHaveBeenCalled();
  expect(Observer.instances).toHaveLength(count);
  expect(sceneStore.getState().chapter).toBe(0);
  expect(heightRead).not.toHaveBeenCalled();
});

it("preserves unsupported IO measurement, scroll, resize and cleanup", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  const bounds = vi.spyOn(document.getElementById("why")!, "getBoundingClientRect");
  bounds.mockReturnValue({ top: 500 } as DOMRect);
  const { unmount } = render(<Probe />);
  expect(sceneStore.getState().chapter).toBe(5);
  bounds.mockReturnValue({ top: 501 } as DOMRect);
  act(() => window.dispatchEvent(new Event("scroll")));
  expect(sceneStore.getState().chapter).toBe(0);
  bounds.mockReturnValue({ top: -2000 } as DOMRect);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(sceneStore.getState().chapter).toBe(5);
  unmount(); bounds.mockClear(); heightRead.mockClear();
  act(() => { window.dispatchEvent(new Event("scroll")); window.dispatchEvent(new Event("resize")); });
  expect(bounds).not.toHaveBeenCalled();
  expect(heightRead).not.toHaveBeenCalled();
});
