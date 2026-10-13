"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { sceneStore, useSceneStore } from "../store";
import { qualityForTier } from "./config";
import { createCreatureRig } from "./rig";

/**
 * The koi that turns into a dragon. Reads the scene store inside the frame loop (no React re-render per frame);
 * only a tier change rebuilds it, with fewer rings on `low`.
 */
export function Creature() {
  const tier = useSceneStore((s) => (s.tier === "low" ? "low" : "high"));
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const rig = useMemo(() => createCreatureRig(qualityForTier(tier), { maxAnisotropy }), [tier, maxAnisotropy]);

  useEffect(() => () => rig.dispose(), [rig]);

  useFrame((state, delta) => {
    rig.update({ dt: delta, time: state.clock.elapsedTime, camera: state.camera, state: sceneStore.getState() });
  });

  return <primitive object={rig.root} />;
}
