import { Group } from "three";
import type { Prop } from "./types";

/** Load and build scenery on approach, with the latest scroll/theme snapshot and safe late-unmount cleanup. */
export function createDeferredProp(name: string, load: () => Promise<() => Prop>, needed: (position: number) => boolean): Prop {
  const root = new Group(); root.name = name;
  let requested = false, disposed = false, active: Prop | undefined;
  let time = 0, position = 0, day = 0;
  return {
    root,
    update(nextTime, nextPosition, nextDay) {
      if (disposed) return;
      time = nextTime; position = nextPosition; day = nextDay;
      if (active) { active.update(time, position, day); return; }
      if (requested || !needed(position)) return;
      requested = true;
      void load().then((create) => {
        if (disposed) return;
        active = create(); root.add(active.root); active.update(time, position, day);
      }).catch(() => {
        // A missing scenery chunk must not break the usable portfolio or create a retry every frame.
        // The shared pond and creature remain; a full navigation can request the chunk again.
        if (active) { root.remove(active.root); active.dispose(); active = undefined; }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (active) { root.remove(active.root); active.dispose(); active = undefined; }
    },
  };
}
