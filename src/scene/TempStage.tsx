"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { PMREMGenerator, type HemisphereLight, type PointLight, type DirectionalLight } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { creatureLive } from "./creature/live";
import { lerp } from "./creature/profiles";
import { sceneStore } from "./store";

/**
 * TEMPORARY stage (Task 15) so the creature is visible and lit: a studio environment map for the PBR
 * reflections, a key light, a sky/ground fill, an orange light hovering over the head, and a camera that pulls
 * back for the dragon. Task 16 replaces this file with the pond, its lighting and the per-chapter cameras.
 */
export function TempStage() {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const hemi = useRef<HemisphereLight>(null);
  const key = useRef<DirectionalLight>(null);
  const glow = useRef<PointLight>(null);

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    const { scene } = get();
    scene.environment = env;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, get]);

  useFrame(({ camera, clock }) => {
    const m = creatureLive.morph;
    const t = clock.elapsedTime;
    camera.position.set(Math.sin(t * 0.1) * 0.4, lerp(3.2, 6.2, m), lerp(3.5, 7.0, m));
    camera.lookAt(0, m * 0.55, 0);
    const light = sceneStore.getState().theme === "light";
    if (hemi.current) hemi.current.intensity = light ? 0.7 : 0.3;
    if (key.current) key.current.intensity = light ? 1.2 : 0.8;
    if (glow.current) {
      const h = creatureLive.head;
      glow.current.position.set(h.x, h.y + 1.6, h.z);
      glow.current.intensity = light ? 0.8 : 1.8;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[0xbcd7ff, 0x1a0d05, 0.3]} />
      <directionalLight ref={key} position={[3, 6, 2]} intensity={0.8} />
      <pointLight ref={glow} color={0xff8a3d} intensity={1.8} distance={6} decay={1.6} />
    </>
  );
}
