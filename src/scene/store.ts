import { useSyncExternalStore } from "react";
import type { RoleKey } from "@/content/schema";
import type { Theme } from "@/components/site/theme";
import type { Rect } from "./environment/legibility";
import type { Food } from "./interactions/feed";
import type { Tier } from "./tier";

export type { Food };

/** A click on the water that has not been turned into food yet: the spot in normalised device coordinates. */
export type DropRequest = { x: number; y: number; id: number };

export type SceneState = {
  /** Section index (0 hero ... 6 contact). */
  chapter: number;
  /** Progress through the chapter, 0 to 1. */
  t: number;
  /** Pointer in normalised device coordinates (-1 to 1, y up), or null while it is somewhere the scene ignores. */
  pointer: { x: number; y: number } | null;
  theme: Theme;
  role: RoleKey;
  tier: Tier;
  foods: Food[];
  /**
   * Blocks of text on screen (viewport pixels, `[data-scene-avoid]`), measured on scroll and resize. The water
   * keeps them readable and the creature fades while it swims under them.
   */
  avoid: Rect[];
  /** The latest click on a `[data-water-zone]`, waiting for the scene to raycast it onto the water. */
  drop: DropRequest | null;
};

const INITIAL: SceneState = {
  chapter: 0,
  t: 0,
  pointer: null,
  theme: "dark",
  role: "fullstack",
  tier: "off",
  foods: [],
  avoid: [],
  drop: null,
};

type Patch = Partial<SceneState> | ((s: SceneState) => Partial<SceneState>);

/**
 * A tiny external store. The page writes scroll and pointer data here from event handlers; only the
 * subscribers (the canvas, via useFrame or a selector) react, so the React tree does not re-render.
 */
export function createSceneStore() {
  let state: SceneState = { ...INITIAL };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    /** Shallow-merges `patch`. A patch that changes nothing keeps the snapshot and notifies nobody. */
    setState(patch: Patch) {
      const part = typeof patch === "function" ? patch(state) : patch;
      let changed = false;
      for (const key of Object.keys(part) as (keyof SceneState)[]) {
        if (!Object.is(part[key], state[key])) changed = true;
      }
      if (!changed) return;
      state = { ...state, ...part };
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Back to the defaults (tests). */
    reset() {
      state = { ...INITIAL };
      listeners.forEach((l) => l());
    },
  };
}

export const sceneStore = createSceneStore();

/** Subscribes a component to one slice. Return primitives (or stable references) from `select`. */
export function useSceneStore<T>(select: (s: SceneState) => T): T {
  return useSyncExternalStore(
    sceneStore.subscribe,
    () => select(sceneStore.getState()),
    () => select(INITIAL),
  );
}
