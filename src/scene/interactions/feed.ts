/** A pellet of fish food on the water. `x`/`z` are pond coordinates, `t0` the drop time in seconds (scene clock). */
export type Food = { id: number; x: number; z: number; t0: number };

/** Pellets on the water at once (spec 6, item 9). */
export const MAX_FOOD = 5;
/** How close the koi's snout must get to a pellet to eat it (pond units). */
export const EAT_RADIUS = 0.15;
/** A pellet falls this long before it touches the water; the ripple and the koi's interest start then. */
export const FOOD_FALL_SECONDS = 0.35;
/** A pellet nobody eats sinks after this long. */
export const FOOD_LIFETIME_SECONDS = 25;

let lastId = 0;

/**
 * The pellets with one more at `p`, dropped at `now`. At most `MAX_FOOD` stay: the oldest one is dropped first.
 * Returns a new array; ids are never reused, so an eaten pellet can not be mistaken for a later one.
 */
export function addFood(
  foods: Food[],
  p: { x: number; z: number },
  now: number,
): Food[] {
  const next = [...foods, { id: ++lastId, x: p.x, z: p.z, t0: now }];
  return next.length > MAX_FOOD ? next.slice(next.length - MAX_FOOD) : next;
}

/**
 * The pellet closest to `head` on the water plane, or null when there is none. With `now`, pellets still in the air
 * are ignored. No allocation.
 */
export function nearestFood(
  foods: readonly Food[],
  head: { x: number; z: number },
  now?: number,
): Food | null {
  let best: Food | null = null;
  let bestD = Infinity;
  for (const f of foods) {
    if (now !== undefined && now - f.t0 < FOOD_FALL_SECONDS) continue;
    const d = (f.x - head.x) ** 2 + (f.z - head.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/**
 * The pellets left after the koi at `head` eats every one within `radius`. The same array when none was eaten.
 * With `now`, a pellet still in the air is out of reach.
 */
export function eatFood(
  foods: Food[],
  head: { x: number; z: number },
  radius = EAT_RADIUS,
  now?: number,
): Food[] {
  const r2 = radius * radius;
  const inReach = (f: Food) =>
    (now === undefined || now - f.t0 >= FOOD_FALL_SECONDS) &&
    (f.x - head.x) ** 2 + (f.z - head.z) ** 2 <= r2;
  return foods.some(inReach) ? foods.filter((f) => !inReach(f)) : foods;
}

/** The pellets that have fallen onto the water by `now`: the only ones a koi goes for. */
export function landedFood(foods: readonly Food[], now: number): Food[] {
  return foods.filter((f) => now - f.t0 >= FOOD_FALL_SECONDS);
}

/** The pellets that have not sunk yet. The same array when none has. */
export function pruneFood(foods: Food[], now: number): Food[] {
  // Checked first so the common case (nothing has sunk) allocates nothing.
  let expired = false;
  for (let i = 0; i < foods.length; i++) {
    if (now - foods[i].t0 >= FOOD_LIFETIME_SECONDS) {
      expired = true;
      break;
    }
  }
  return expired
    ? foods.filter((f) => now - f.t0 < FOOD_LIFETIME_SECONDS)
    : foods;
}
