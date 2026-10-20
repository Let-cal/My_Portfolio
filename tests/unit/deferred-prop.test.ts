import { describe, expect, it, vi } from "vitest";
import { Group } from "three";
import { createDeferredProp } from "@/scene/environment/props/deferred-prop";
import type { Prop } from "@/scene/environment/props/types";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const inGarden = (position: number) => position >= 1 && position < 4.2;

describe("deferred scenery", () => {
  it("does no module or geometry work at Hero, then loads once before the garden and catches up to current scroll", async () => {
    let resolve!: (factory: () => Prop) => void;
    const load = vi.fn(
      () =>
        new Promise<() => Prop>((done) => {
          resolve = done;
        }),
    );
    const update = vi.fn(),
      dispose = vi.fn();
    const factory = vi.fn(() => ({ root: new Group(), update, dispose }));
    const prop = createDeferredProp("garden", load, inGarden);
    prop.update(1, 0, 1);
    prop.update(2, 0.8, 1);
    expect(load).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
    prop.update(3, 1.1, 1);
    prop.update(4, 2.5, 0);
    expect(load).toHaveBeenCalledTimes(1);
    resolve(factory);
    await tick();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith(4, 2.5, 0);
    expect(prop.root.children).toHaveLength(1);
    prop.update(5, 3, 0);
    expect(update).toHaveBeenLastCalledWith(5, 3, 0);
    prop.dispose();
    prop.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("never constructs late geometry after unmount, or when jumping straight past the garden", async () => {
    let resolve!: (factory: () => Prop) => void;
    const load = vi.fn(
      () =>
        new Promise<() => Prop>((done) => {
          resolve = done;
        }),
    );
    const factory = vi.fn(() => ({
      root: new Group(),
      update: vi.fn(),
      dispose: vi.fn(),
    }));
    const prop = createDeferredProp("garden", load, inGarden);
    prop.update(1, 6, 0);
    expect(load).not.toHaveBeenCalled();
    prop.update(2, 2, 0);
    prop.dispose();
    resolve(factory);
    await tick();
    expect(factory).not.toHaveBeenCalled();
    expect(prop.root.children).toHaveLength(0);
  });

  it("handles a failed lazy chunk without retrying every animation frame", async () => {
    const load = vi.fn(async () => {
      throw Error("offline");
    });
    const prop = createDeferredProp("garden", load, inGarden);
    prop.update(1, 2, 0);
    await tick();
    for (let frame = 0; frame < 100; frame++) prop.update(frame, 3, 0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(prop.root.children).toHaveLength(0);
    prop.dispose();
  });
});
