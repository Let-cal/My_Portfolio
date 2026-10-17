import { describe, expect, it } from "vitest";
import {
  addFood,
  eatFood,
  EAT_RADIUS,
  FOOD_FALL_SECONDS,
  FOOD_LIFETIME_SECONDS,
  landedFood,
  MAX_FOOD,
  nearestFood,
  pruneFood,
  type Food,
} from "@/scene/interactions/feed";

const at = (x: number, z: number) => ({ x, z });

describe("addFood", () => {
  it("keeps at most 5 pellets and drops the oldest one first", () => {
    let foods: Food[] = [];
    for (let i = 0; i < 6; i++) foods = addFood(foods, at(i, 0), i);
    expect(MAX_FOOD).toBe(5);
    expect(foods).toHaveLength(5);
    // The first pellet (x = 0) is gone, the second (x = 1) is now the oldest.
    expect(foods.map((f) => f.x)).toEqual([1, 2, 3, 4, 5]);
    expect(foods[0].t0).toBe(1);
  });

  it("gives every pellet its own id and does not mutate the list it was given", () => {
    const first = addFood([], at(0, 0), 0);
    const second = addFood(first, at(1, 1), 0.1);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
    expect(new Set(second.map((f) => f.id)).size).toBe(2);
    expect(second[1]).toMatchObject({ x: 1, z: 1, t0: 0.1 });
  });

  it("never reuses the id of a pellet that was eaten", () => {
    let foods = addFood([], at(0, 0), 0);
    const eatenId = foods[0].id;
    foods = eatFood(foods, at(0, 0));
    foods = addFood(foods, at(2, 2), 1);
    expect(foods[0].id).not.toBe(eatenId);
  });
});

describe("eatFood", () => {
  it("removes the pellets inside the radius (0.15 by default) and keeps the rest", () => {
    const foods = [
      { id: 1, x: 0.1, z: 0, t0: 0 },
      { id: 2, x: 0.5, z: 0, t0: 0 },
      { id: 3, x: 0, z: -0.14, t0: 0 },
      { id: 4, x: 0, z: 0.16, t0: 0 },
    ];
    expect(EAT_RADIUS).toBe(0.15);
    expect(eatFood(foods, at(0, 0)).map((f) => f.id)).toEqual([2, 4]);
  });

  it("takes a custom radius and returns the same array when nothing was eaten", () => {
    const foods = [{ id: 1, x: 1, z: 1, t0: 0 }];
    expect(eatFood(foods, at(0, 0))).toBe(foods);
    expect(eatFood(foods, at(0, 0), 2)).toEqual([]);
  });

  it("with a time, leaves a pellet that is still falling alone", () => {
    const foods = [{ id: 1, x: 0, z: 0, t0: 10 }];
    expect(eatFood(foods, at(0, 0), 0.15, 10.1)).toBe(foods);
    expect(eatFood(foods, at(0, 0), 0.15, 10.5)).toEqual([]);
  });
});

describe("nearestFood", () => {
  it("is null with no food", () => expect(nearestFood([], at(0, 0))).toBeNull());

  it("picks the pellet closest to the head on the water plane", () => {
    const foods = [
      { id: 1, x: 3, z: 0, t0: 0 },
      { id: 2, x: -1, z: 1, t0: 0 },
      { id: 3, x: 0, z: 2.5, t0: 0 },
    ];
    expect(nearestFood(foods, at(0, 0))?.id).toBe(2);
    expect(nearestFood(foods, at(2.5, 0.2))?.id).toBe(1);
  });

  it("with a time, skips pellets that are still falling", () => {
    const foods = [
      { id: 1, x: 3, z: 0, t0: 0 },
      { id: 2, x: 0.1, z: 0, t0: 9.9 },
    ];
    expect(nearestFood(foods, at(0, 0), 10)?.id).toBe(1);
    expect(nearestFood(foods, at(0, 0), 10.5)?.id).toBe(2);
    expect(nearestFood([{ id: 3, x: 0, z: 0, t0: 10 }], at(0, 0), 10)).toBeNull();
  });
});

describe("landedFood and pruneFood", () => {
  const foods = [
    { id: 1, x: 0, z: 0, t0: 0 },
    { id: 2, x: 1, z: 0, t0: 5 },
  ];

  it("a pellet is only food for the koi once it has fallen onto the water", () => {
    expect(landedFood(foods, FOOD_FALL_SECONDS - 0.01)).toEqual([]);
    expect(landedFood(foods, FOOD_FALL_SECONDS + 0.01).map((f) => f.id)).toEqual([1]);
    expect(landedFood(foods, 10).map((f) => f.id)).toEqual([1, 2]);
  });

  it("uneaten pellets sink after their lifetime", () => {
    expect(pruneFood(foods, FOOD_LIFETIME_SECONDS - 1)).toBe(foods);
    expect(pruneFood(foods, FOOD_LIFETIME_SECONDS + 1).map((f) => f.id)).toEqual([2]);
  });
});
