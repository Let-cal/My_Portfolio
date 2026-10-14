import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creatureLive } from "@/scene/creature/live";
import { sceneLive } from "@/scene/environment/live";
import { sceneStore } from "@/scene/store";
import { TextVeil } from "@/scene/TextVeil";

const panels = () => [...document.querySelectorAll<HTMLElement>("[data-koi-veil] > i")];
const tick = () => act(() => void vi.advanceTimersByTime(40));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  sceneStore.reset();
  sceneLive.day = 0;
  sceneLive.props = 0;
  creatureLive.screen.valid = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TextVeil", () => {
  it("is an inert decoration", () => {
    const { container } = render(<TextVeil />);
    const host = container.querySelector("[data-koi-veil]")!;
    expect(host).toHaveAttribute("aria-hidden", "true");
  });

  it("draws one panel behind each block of text, padded, and only moves them as the text moves", () => {
    render(<TextVeil />);
    act(() => sceneStore.setState({ avoid: [{ x0: 100, y0: 200, x1: 300, y1: 260 }] }));
    const [panel] = panels();
    expect(panel.style.display).toBe("block");
    expect(panel.style.width).toBe("248px");
    expect(panel.style.height).toBe("108px");
    expect(panel.style.transform).toBe("translate3d(76px, 176px, 0)");
    act(() => sceneStore.setState({ avoid: [{ x0: 100, y0: 150, x1: 300, y1: 210 }] }));
    expect(panels()).toHaveLength(1);
    expect(panels()[0].style.transform).toBe("translate3d(76px, 126px, 0)");
  });

  it("hides panels that are no longer needed instead of discarding them", () => {
    render(<TextVeil />);
    act(() =>
      sceneStore.setState({
        avoid: [
          { x0: 0, y0: 0, x1: 50, y1: 50 },
          { x0: 100, y0: 100, x1: 150, y1: 150 },
        ],
      }),
    );
    expect(panels().filter((p) => p.style.display === "block")).toHaveLength(2);
    act(() => sceneStore.setState({ avoid: [{ x0: 0, y0: 0, x1: 50, y1: 50 }] }));
    expect(panels().filter((p) => p.style.display === "block")).toHaveLength(1);
    expect(panels()[1].style.display).toBe("none");
  });

  it("stays faint on a calm night pond and comes up when the creature swims near the text, by day and with scenery", () => {
    render(<TextVeil />);
    act(() => sceneStore.setState({ avoid: [{ x0: 500, y0: 500, x1: 700, y1: 560 }] }));
    tick();
    expect(Number(panels()[0].style.opacity)).toBeLessThan(0.3);

    // The koi swims up to the text.
    Object.assign(creatureLive.screen, { valid: true, x0: 400, y0: 450, x1: 520, y1: 520 });
    tick();
    expect(Number(panels()[0].style.opacity)).toBe(1);

    // It swims away again.
    Object.assign(creatureLive.screen, { valid: true, x0: 1000, y0: 100, x1: 1100, y1: 160 });
    tick();
    expect(Number(panels()[0].style.opacity)).toBeLessThan(0.3);

    sceneLive.props = 1;
    tick();
    expect(Number(panels()[0].style.opacity)).toBe(1);
    sceneLive.props = 0;
    tick();
    sceneLive.day = 1;
    tick();
    expect(Number(panels()[0].style.opacity)).toBe(1);
  });

  it("hands a panel to a different block of text without easing from the old block's opacity", () => {
    render(<TextVeil />);
    Object.assign(creatureLive.screen, { valid: true, x0: 400, y0: 450, x1: 520, y1: 520 });
    act(() => sceneStore.setState({ avoid: [{ x0: 500, y0: 500, x1: 700, y1: 560 }] }));
    tick();
    expect(Number(panels()[0].style.opacity)).toBe(1);
    // The same panel now sits behind text far from the creature: it takes the calm value at once.
    act(() => sceneStore.setState({ avoid: [{ x0: 1000, y0: 100, x1: 1200, y1: 160 }] }));
    act(() => void vi.advanceTimersByTime(16));
    expect(Number(panels()[0].style.opacity)).toBeLessThan(0.3);
    expect(panels()[0].style.transition).toBe("none");
    // And it eases again afterwards.
    tick();
    expect(panels()[0].style.transition).toBe("");
  });

  it("removes its panels and stops its animation loop when unmounted", () => {
    const { unmount, container } = render(<TextVeil />);
    act(() => sceneStore.setState({ avoid: [{ x0: 0, y0: 0, x1: 50, y1: 50 }] }));
    unmount();
    expect(container.querySelectorAll("i")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
