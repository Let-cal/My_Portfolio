import { Color } from "three";

/** Authored in sRGB, decoded once into the renderer's linear working space. */
export const GARDEN_NIGHT = {
  sky: new Color("#04070b"),
  horizon: new Color("#0b1318"),
  water: new Color("#091217"),
  foam: new Color("#6b828a"),
  deep: new Color("#101e26"),
  // Deliberate linear emission values: restrained moon halo and warm submerged circuitry.
  halo: new Color().setRGB(0.018, 0.025, 0.035),
  grid: new Color().setRGB(0.18, 0.13, 0.075),
};

/** GLSL constants are baked at module load; no extra uniforms or work per frame. */
export const GARDEN_NIGHT_GLSL = Object.fromEntries(
  Object.entries(GARDEN_NIGHT).map(([key, color]) => [key,
    `vec3(${color.toArray().map((n) => n.toFixed(7)).join(", ")})`,
  ]),
) as Record<keyof typeof GARDEN_NIGHT, string>;
