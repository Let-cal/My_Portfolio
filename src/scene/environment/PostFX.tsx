"use client";

import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Selective bloom for the `high` tier (spec 5.1): only what is brighter than the threshold glows, which is the
 * creature's emissive circuits, the lanterns and the gate's traces; the lit ivory skin and the water stay below it.
 * Loaded lazily, so the `low` tier never downloads the post-processing code. The composer renders the scene itself
 * and takes over tone mapping, hence the explicit ACES pass (the same curve the `low` tier gets from the renderer).
 */
export default function PostFX() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.55} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
