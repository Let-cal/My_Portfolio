import { render, screen } from "@testing-library/react";
import type { CSSProperties, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import SceneRoot from "@/scene/SceneRoot";

// jsdom has no WebGL. This Canvas stand-in mirrors the one thing about @react-three/fiber that matters here:
// its wrapper div is `pointer-events: auto` unless the caller's `style` says otherwise.
const canvasProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ style, children, ...rest }: { style?: CSSProperties; children?: ReactNode } & Record<string, unknown>) => {
    canvasProps.last = rest;
    return (
      <div data-testid="r3f" style={{ position: "relative", pointerEvents: "auto", ...style }}>
        {children}
      </div>
    );
  },
  useFrame: () => {},
}));
// The creature and the stage need WebGL; their logic is covered by creature-math.test.ts.
vi.mock("@/scene/creature/Creature", () => ({ Creature: () => null }));
vi.mock("@/scene/TempStage", () => ({ TempStage: () => null }));

describe("SceneRoot", () => {
  it("never catches pointer events: the canvas container is pointer-events none", () => {
    render(<SceneRoot tier="high" onReadyChange={() => {}} onDowngrade={() => {}} />);
    expect(screen.getByTestId("r3f")).toHaveStyle({ pointerEvents: "none" });
  });

  it("caps the pixel ratio by tier and pauses rendering while the tab is hidden", () => {
    const { rerender } = render(<SceneRoot tier="high" onReadyChange={() => {}} onDowngrade={() => {}} />);
    expect(canvasProps.last).toMatchObject({ dpr: [1, 1.5], frameloop: "always" });
    rerender(<SceneRoot tier="low" onReadyChange={() => {}} onDowngrade={() => {}} />);
    expect(canvasProps.last).toMatchObject({ dpr: [1, 1.25] });
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    rerender(<SceneRoot tier="low" onReadyChange={() => {}} onDowngrade={() => {}} />);
    expect(canvasProps.last).toMatchObject({ frameloop: "never" });
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
  });
});
