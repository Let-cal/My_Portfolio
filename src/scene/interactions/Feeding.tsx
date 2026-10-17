"use client";

import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSound, type SoundKind } from "@/components/fx/sound";
import { createFeeder } from "./feeder";

/** Mounts the fish food (see `createFeeder`). */
export function Feeding() {
  const { play } = useSound();
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  }, [play]);
  // One function for the life of the component: nothing is allocated per frame.
  const playDrop = useCallback((kind: SoundKind) => playRef.current(kind), []);

  const feeder = useMemo(() => createFeeder(), []);
  useEffect(() => () => feeder.dispose(), [feeder]);
  useFrame(({ camera, clock }) => feeder.update(camera, clock.elapsedTime, playDrop));

  return <primitive object={feeder.mesh} />;
}
