"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type DirectionalLight, type HemisphereLight, type PointLight } from "three";
import { creatureLive } from "../creature/live";
import { lerp } from "../creature/profiles";
import { sceneLive } from "./live";

/** Night and day settings; `sceneLive.day` blends between them (600 ms), so the theme switch never pops. */
const NIGHT = {
  hemiSky: new Color(0xbcd7ff),
  hemiGround: new Color(0x1a0d05),
  hemi: 0.3,
  key: new Color(0xffffff),
  keyIntensity: 0.8,
  glow: new Color(0xff8a3d),
  glowIntensity: 1.8,
};
const DAY = {
  hemiSky: new Color(0xf2f9ff),
  hemiGround: new Color(0x6fa7b8),
  hemi: 0.75,
  key: new Color(0xfff1d8),
  keyIntensity: 1.25,
  glow: new Color(0xffb878),
  glowIntensity: 0.7,
};

/**
 * Hemisphere sky/ground fill, a key light and the point light that hovers over the creature's head (the orange
 * glow of the Cyber Koi). Night and day change their colour and strength, nothing else.
 */
export function Lighting() {
  const hemi = useRef<HemisphereLight>(null);
  const key = useRef<DirectionalLight>(null);
  const glow = useRef<PointLight>(null);
  const initial = useMemo(() => ({ sky: NIGHT.hemiSky.clone(), ground: NIGHT.hemiGround.clone() }), []);

  useFrame(() => {
    const day = sceneLive.day;
    if (hemi.current) {
      hemi.current.color.copy(NIGHT.hemiSky).lerp(DAY.hemiSky, day);
      hemi.current.groundColor.copy(NIGHT.hemiGround).lerp(DAY.hemiGround, day);
      hemi.current.intensity = lerp(NIGHT.hemi, DAY.hemi, day);
    }
    if (key.current) {
      key.current.color.copy(NIGHT.key).lerp(DAY.key, day);
      key.current.intensity = lerp(NIGHT.keyIntensity, DAY.keyIntensity, day);
    }
    if (glow.current) {
      const h = creatureLive.head;
      glow.current.position.set(h.x, h.y + 1.6, h.z);
      glow.current.color.copy(NIGHT.glow).lerp(DAY.glow, day);
      // Dimmed along with the creature while it swims under text.
      glow.current.intensity = lerp(NIGHT.glowIntensity, DAY.glowIntensity, day) * creatureLive.visibility;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[initial.sky, initial.ground, NIGHT.hemi]} />
      <directionalLight ref={key} position={[3, 6, 2]} intensity={NIGHT.keyIntensity} />
      <pointLight ref={glow} color={NIGHT.glow} intensity={NIGHT.glowIntensity} distance={6} decay={1.6} />
    </>
  );
}
