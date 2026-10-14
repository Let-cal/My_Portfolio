"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { sceneLive } from "./live";
import { createGate } from "./props/gate";
import { createLanterns } from "./props/lanterns";
import { createLotus } from "./props/lotus";
import { createWaterfall } from "./props/waterfall";

/**
 * The scenery of the story: lily pads and lotus flowers (chapter 2), a waterfall (3), lanterns on both shores (4) and
 * a gate (5). Each fades in and out with the distance between its chapter and the story position, so the pond is
 * one continuous scene. Built once; the props only move their own instances each frame.
 */
export function Props() {
  const props = useMemo(() => [createLotus(), createWaterfall(), createLanterns(), createGate()], []);
  useEffect(
    () => () => {
      for (const p of props) p.dispose();
    },
    [props],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let i = 0; i < props.length; i++) props[i].update(t, sceneLive.pos, sceneLive.day);
  });

  return (
    <>
      {props.map((p) => (
        <primitive key={p.root.name} object={p.root} />
      ))}
    </>
  );
}
