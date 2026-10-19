import { vi } from "vitest";

/**
 * jsdom has no IntersectionObserver, and `motion`'s `whileInView` (used by `Reveal`, which the section components
 * render) throws without one. Tests that render those sections opt in to this stub; it is deliberately NOT global
 * so the "no IntersectionObserver" fallbacks of the other components stay under test.
 *
 * `visible: true` reports every observed element as intersecting right away (for components that start on view).
 */
export function stubIntersectionObserver({
  visible = false,
}: { visible?: boolean } = {}) {
  class StubObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];
    constructor(private readonly cb: (entries: unknown[]) => void) {}
    observe(target: Element) {
      if (visible)
        this.cb([{ isIntersecting: true, intersectionRatio: 1, target }]);
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", StubObserver);
}
