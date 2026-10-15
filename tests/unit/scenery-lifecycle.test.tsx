import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const probe = vi.hoisted(() => ({ frame: null as null | ((state: { clock: { elapsedTime: number } }) => void), updates: 0, disposed: 0 }));
vi.mock("@react-three/fiber", () => ({ useFrame: (frame: typeof probe.frame) => { probe.frame = frame; } }));
vi.mock("@/scene/environment/props/deferred-prop", async () => {
  const { Group } = await import("three");
  return { createDeferredProp() {
    let disposed = false;
    return { root: new Group(), update() { if (!disposed) probe.updates++; }, dispose() { if (!disposed) probe.disposed++; disposed = true; } };
  } };
});
import { Props } from "@/scene/environment/Props";

afterEach(() => { cleanup(); vi.restoreAllMocks(); probe.updates = probe.disposed = 0; });

it("recreates scenery ownership when Strict Mode replays effects, so the garden can still update", () => {
  // React DOM hosts the lifecycle only; real primitive rendering is covered in the browser suite.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const { unmount } = render(<StrictMode><Props /></StrictMode>);
  act(() => probe.frame?.({ clock: { elapsedTime: 1 } }));
  expect(probe.updates).toBe(1);
  expect(probe.disposed).toBe(1);
  unmount(); expect(probe.disposed).toBe(2);
});
