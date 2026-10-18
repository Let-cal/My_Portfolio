import { PerspectiveCamera } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creatureLive } from "@/scene/creature/live";
import { FOOD_FALL_SECONDS, FOOD_LIFETIME_SECONDS, MAX_FOOD } from "@/scene/interactions/feed";
import { createFeeder } from "@/scene/interactions/feeder";
import { sceneStore } from "@/scene/store";

function camera() {
  const c = new PerspectiveCamera(40, 16 / 9, 0.1, 80);
  c.position.set(0, 3.8, 4.2);
  c.lookAt(0, -0.15, 0.1);
  c.updateMatrixWorld();
  return c;
}

let feeder: ReturnType<typeof createFeeder>;
let dropId = 0;
const click = (x = 0, y = 0) => sceneStore.setState({ drop: { x, y, id: ++dropId } });

beforeEach(() => {
  sceneStore.reset();
  feeder = createFeeder();
  // The creature is far away: it eats nothing unless a test moves it.
  Object.assign(creatureLive.head, { x: 20, y: 0, z: 20 });
  creatureLive.morph = 0;
  vi.spyOn(Math, "random").mockReturnValue(0.99);
});
afterEach(() => {
  feeder.dispose();
  vi.restoreAllMocks();
});

describe("feeder: click to food", () => {
  it("raycasts a drop request onto the water and adds one to three pellets, in the pond", () => {
    const play = vi.fn();
    click(0, 0);
    feeder.update(camera(), 0, play);
    const foods = sceneStore.getState().foods;
    expect(foods.length).toBeGreaterThanOrEqual(1);
    expect(foods.length).toBeLessThanOrEqual(3);
    for (const f of foods) {
      expect(Number.isFinite(f.x) && Number.isFinite(f.z)).toBe(true);
      expect(Math.abs(f.x)).toBeLessThanOrEqual(4.5);
      expect(f.z).toBeGreaterThanOrEqual(-3);
      expect(f.z).toBeLessThanOrEqual(1.6);
    }
    // The first pellet lands under the click: the centre of the screen looks at the middle of the pond.
    expect(Math.hypot(foods[0].x, foods[0].z)).toBeLessThan(0.6);
    expect(feeder.mesh.count).toBe(foods.length);
    // Still in the air: no sound yet.
    expect(play).not.toHaveBeenCalled();
  });

  it("handles one request once, and never keeps more than five pellets however often it is clicked", () => {
    const cam = camera();
    click();
    feeder.update(cam, 0, vi.fn());
    const first = sceneStore.getState().foods.length;
    feeder.update(cam, 0.01, vi.fn());
    expect(sceneStore.getState().foods).toHaveLength(first);
    for (let i = 0; i < 6; i++) {
      click(0.1 * i, 0);
      feeder.update(cam, 0.02 + i * 0.01, vi.fn());
    }
    expect(sceneStore.getState().foods.length).toBeLessThanOrEqual(MAX_FOOD);
    expect(feeder.mesh.count).toBe(sceneStore.getState().foods.length);
  });

  it("splashes and plays the drop sound once per pellet when it reaches the water", () => {
    const cam = camera();
    const play = vi.fn();
    click();
    feeder.update(cam, 0, play);
    const n = sceneStore.getState().foods.length;
    // After the fall (and the stagger between pellets) every pellet has landed.
    feeder.update(cam, FOOD_FALL_SECONDS + 1, play);
    feeder.update(cam, FOOD_FALL_SECONDS + 1.1, play);
    expect(play).toHaveBeenCalledTimes(n);
    expect(play).toHaveBeenCalledWith("drop");
  });

  it("the koi eats a landed pellet in reach, and uneaten ones sink in time", () => {
    const cam = camera();
    click();
    feeder.update(cam, 0, vi.fn());
    const [first] = sceneStore.getState().foods;
    feeder.update(cam, 1, vi.fn());
    // The snout reaches the first pellet.
    Object.assign(creatureLive.head, { x: first.x, y: 0, z: first.z });
    feeder.update(cam, 1.1, vi.fn());
    expect(sceneStore.getState().foods.some((f) => f.id === first.id)).toBe(false);
    // Nobody eats the rest.
    Object.assign(creatureLive.head, { x: 20, y: 0, z: 20 });
    feeder.update(cam, FOOD_LIFETIME_SECONDS + 5, vi.fn());
    expect(sceneStore.getState().foods).toEqual([]);
    expect(feeder.mesh.count).toBe(0);
  });

  it("ignores a drop request that misses the water (a click above the horizon)", () => {
    click(0, 1);
    // Looking straight up: the ray never reaches the plane.
    const sky = camera();
    sky.lookAt(0, 20, -5);
    sky.updateMatrixWorld();
    feeder.update(sky, 0, vi.fn());
    expect(sceneStore.getState().foods).toEqual([]);
  });
});
