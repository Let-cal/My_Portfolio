import { createRipples } from "./ripples";

/**
 * Per-frame state of the stage that the pond's parts share: written by `Stage`, read by the water, props, lights
 * and the veil. Plain mutable data, so reading it never re-renders React.
 */
export const sceneLive = {
  /** The story as a smoothed number: chapter 2 at its start is 2, halfway to chapter 3 is 2.5 (see `chapterPosition`). */
  pos: 0,
  /** Night (0) to day (1), eased. */
  day: 0,
  /** Linear 0 to 1 ramp behind `day`. */
  dayRaw: 0,
  /** How much scenery (lily pads, waterfall, lanterns, gate) is on screen, 0 to 1. */
  props: 0,
  /** Where the river has flowed to (chapter 1 makes it run). */
  flow: 0,
  /** Ripples on the water, fed by the tail, the pointer and the food. */
  ripples: createRipples(),
};

export function resetSceneLive(day: number) {
  sceneLive.pos = 0;
  sceneLive.day = day;
  sceneLive.dayRaw = day;
  sceneLive.flow = 0;
  sceneLive.props = 0;
  sceneLive.ripples.next = 0;
  for (let i = 0; i < sceneLive.ripples.data.length; i += 3) sceneLive.ripples.data[i + 2] = -1000;
}
