/** Points along the body the stage reads each frame (for the glow and shadow the creature casts on the water). */
export const BODY_SAMPLES = 6;

/**
 * What the creature is doing this frame, written by the rig and read by the stage (camera, the light that follows
 * the head, the water's wake). Plain mutable data: reading it never re-renders React.
 */
export const creatureLive = {
  /** Smoothed koi (0) to dragon (1) blend actually shown. */
  morph: 0,
  /** How much the body is scattered into a point cloud, 0 (whole) to 1. */
  scatter: 0,
  head: { x: 0, y: 0, z: 0 },
  tail: { x: 0, y: 0, z: 0 },
  /** Head speed in pond units per second. */
  speed: 0,
  /** 1 in the clear, down to about 0.35 while the creature swims under a block of text. */
  visibility: 1,
  /** Box (viewport px) around the creature on screen; `valid` is false until it has been measured. */
  screen: { valid: false, x0: 0, y0: 0, x1: 0, y1: 0 },
  /** `BODY_SAMPLES` points (x, y, z) from the snout to the tail tip. */
  body: new Float32Array(BODY_SAMPLES * 3),
};
