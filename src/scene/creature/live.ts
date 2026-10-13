/**
 * What the creature is doing this frame, written by the rig and read by the stage (camera, the light that follows
 * the head). Plain mutable data: reading it never re-renders React.
 */
export const creatureLive = {
  /** Smoothed koi (0) to dragon (1) blend actually shown. */
  morph: 0,
  head: { x: 0, y: 0, z: 0 },
};
