"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Group } from "three";
import { sceneLive } from "./live";
import { createGate } from "./props/gate";
import { createLanterns } from "./props/lanterns";
import { createLotus } from "./props/lotus";
import { createDeferredProp } from "./props/deferred-prop";
import type { Prop } from "./props/types";

/**
 * The scenery of the story: lily pads and lotus flowers (chapter 2), a waterfall (3), lanterns on both shores (4) and
 * a gate (5). Each fades in and out with the distance between its chapter and the story position, so the pond is
 * one continuous scene. Built once; the props only move their own instances each frame.
 */
export function Props() {
  const root = useMemo(() => new Group(), []);
  const live = useRef<Prop[]>([]);
  useEffect(() => {
    // Effect setup owns resources: Strict Mode may clean up and run setup again on the same component.
    const props = [
      createLotus(),
      createDeferredProp(
        "waterfall-garden",
        () => import("./props/waterfall").then((m) => m.createWaterfall),
        (pos) => pos >= 1 && pos < 4.2,
      ),
      createLanterns(),
      createGate(),
    ];
    live.current = props;
    for (const prop of props) root.add(prop.root);
    return () => {
      live.current = [];
      for (const prop of props) {
        root.remove(prop.root);
        prop.dispose();
      }
    };
  }, [root]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const props = live.current;
    for (let i = 0; i < props.length; i++)
      props[i].update(t, sceneLive.pos, sceneLive.day);
  });

  return <primitive object={root} />;
}
