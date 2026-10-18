import type { Object3D } from "three";

/** A chapter's scenery: built once, updated each frame without allocating, disposed on unmount. */
export type Prop = {
  root: Object3D;
  /** `pos` is the story position (see `chapterPosition`), `day` the eased night (0) to day (1) blend. */
  update(time: number, pos: number, day: number): void;
  dispose(): void;
};

/** Collects GPU resources so a prop frees them all in one call. */
export function createOwner() {
  const items: { dispose(): void }[] = [];
  return {
    own<T extends { dispose(): void }>(x: T): T {
      items.push(x);
      return x;
    },
    disposeAll() {
      for (const x of items) x.dispose();
      items.length = 0;
    },
  };
}
