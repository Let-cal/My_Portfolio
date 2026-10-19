"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { sceneLive } from "../environment/live";
import { sceneStore, useSceneStore } from "../store";
import { qualityForTier } from "./config";
import { createPointCloud, PointCloudMorph } from "./PointCloudMorph";
import { createCreatureRig } from "./rig";

/**
 * The koi that turns into a dragon, and the point cloud it dissolves into on the way. Reads the scene store inside the
 * frame loop (no React re-render per frame); only a tier change rebuilds them, with fewer rings and points on `low`.
 */
export function Creature() {
  const tier = useSceneStore((s) => (s.tier === "low" ? "low" : "high"));
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const rig = useMemo(
    () => createCreatureRig(qualityForTier(tier), { maxAnisotropy }),
    [tier, maxAnisotropy],
  );
  const cloud = useMemo(() => createPointCloud(rig, tier), [rig, tier]);

  useEffect(() => () => cloud.dispose(), [cloud]);
  useEffect(() => () => rig.dispose(), [rig]);

  useFrame((state, delta) => {
    rig.update({
      dt: delta,
      time: state.clock.elapsedTime,
      camera: state.camera,
      state: sceneStore.getState(),
      day: sceneLive.day,
      viewport: state.size,
    });
    cloud.update(
      rig,
      state.clock.elapsedTime,
      sceneLive.day,
      state.size.height * state.gl.getPixelRatio(),
    );
  });

  return (
    <>
      <primitive object={rig.root} />
      <PointCloudMorph cloud={cloud} />
    </>
  );
}
