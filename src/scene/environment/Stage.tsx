"use client";

import { useFrame, useThree, type RootState } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Color,
  Fog,
  PMREMGenerator,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { aspectPullback, cameraAtPosition, chapterPosition } from "../chapters";
import { creatureLive } from "../creature/live";
import { lerp } from "../creature/profiles";
import { sceneStore } from "../store";
import { DAY_BG, NIGHT_BG, WATER_Y } from "./constants";
import { gardenWeight } from "./garden";
import { GARDEN_NIGHT as gardenNight } from "./garden-palette";
import { resetSceneLive, sceneLive } from "./live";
import { dampValue, propWeight, smoothstep, stepDay } from "./math";
import { addRipple } from "./ripples";

/** How quickly the camera and the props follow the scroll (per second): a glide of about a second. */
const FOLLOW_RATE = 2.6;
/** A tail ripple every this many seconds while the creature is on the move (faster when it swims faster). */
const TAIL_RIPPLE_MAX_GAP = 0.55;
const TAIL_RIPPLE_MIN_GAP = 0.2;
const POINTER_RIPPLE_GAP = 0.16;
/** Tail ripples only while the tail is this close to the water. */
const TAIL_WATER_HEIGHT = 0.8;

const NIGHT = new Color(NIGHT_BG);
const DAY = new Color(DAY_BG);
const GARDEN_NIGHT = gardenNight.horizon;
const GARDEN_DAY = new Color().setRGB(0.94, 0.78, 0.57);

/** The air: a background and a haze in the pond's night colour; `update` tints them as the day comes. */
function installBackdrop(scene: Scene): () => void {
  resetSceneLive(sceneStore.getState().theme === "light" ? 1 : 0);
  scene.fog = new Fog(NIGHT_BG, 16, 46);
  scene.background = new Color(NIGHT_BG);
  return () => {
    scene.fog = null;
    scene.background = null;
  };
}

/** The studio environment map the PBR creature reflects, and the undo that frees its GPU memory. */
function installEnvironment(gl: WebGLRenderer, scene: Scene): () => void {
  const pmrem = new PMREMGenerator(gl);
  const room = new RoomEnvironment();
  // The render target holds the texture's GPU memory: disposing the texture alone would leak it.
  const target = pmrem.fromScene(room, 0.04);
  scene.environment = target.texture;
  room.dispose();
  pmrem.dispose();
  return () => {
    scene.environment = null;
    target.dispose();
  };
}

/**
 * The pond's director: once per frame, before everything else draws, it eases the day/night blend (600 ms) and the
 * story position, flies the camera to the chapter's pose, tints the air, and feeds the water ripples from the tail
 * and the pointer. Plain state and no allocation per frame.
 */
function createDirector() {
  const pose = { pos: new Vector3(), look: new Vector3() };
  const ray = new Raycaster();
  const water = new Plane(new Vector3(0, 1, 0), -WATER_Y);
  const hit = new Vector3();
  const ndc = new Vector2();
  const gardenAir = new Color();
  const book = { tail: -1, pointer: -1, pointerX: NaN, pointerY: NaN };

  return {
    update({ camera, clock, size, scene, gl }: RootState, delta: number) {
      const dt = Math.min(delta, 0.1);
      const time = clock.elapsedTime;
      const state = sceneStore.getState();

      // Day and night follow the theme live: a 600 ms ramp, eased.
      sceneLive.dayRaw = stepDay(
        sceneLive.dayRaw,
        state.theme === "light" ? 1 : 0,
        dt,
      );
      sceneLive.day = smoothstep(0, 1, sceneLive.dayRaw);
      const day = sceneLive.day;

      // The camera glides to where the story is. A phone pulls it back, since it sees little sideways.
      const target = chapterPosition(state.chapter, state.t);
      sceneLive.pos = dampValue(sceneLive.pos, target, FOLLOW_RATE, dt);
      const garden = gardenWeight(sceneLive.pos);
      cameraAtPosition(sceneLive.pos, pose);
      const pull = aspectPullback(size.width / Math.max(1, size.height));
      pose.pos.sub(pose.look).multiplyScalar(pull).add(pose.look);
      camera.position.set(
        pose.pos.x + Math.sin(time * 0.1) * 0.35,
        pose.pos.y + Math.sin(time * 0.13) * 0.06,
        pose.pos.z,
      );
      camera.lookAt(pose.look);
      camera.updateMatrixWorld();

      // How much scenery is up (the text veil stays strong where something bright is behind the text).
      sceneLive.props = Math.max(
        garden,
        propWeight(sceneLive.pos, 2),
        propWeight(sceneLive.pos, 3),
        propWeight(sceneLive.pos, 4),
        propWeight(sceneLive.pos, 5),
      );

      // The river runs while chapter 1 is on screen.
      const river = Math.max(0, 1 - Math.abs(sceneLive.pos - 1) * 1.4);
      sceneLive.flow += dt * 0.35 * river;

      // The air takes the pond's colour: dark at night, a pale haze by day.
      gardenAir.copy(GARDEN_NIGHT).lerp(GARDEN_DAY, day);
      if (scene.background instanceof Color)
        scene.background.copy(NIGHT).lerp(DAY, day).lerp(gardenAir, garden);
      if (scene.fog)
        scene.fog.color.copy(NIGHT).lerp(DAY, day).lerp(gardenAir, garden);
      scene.environmentIntensity =
        lerp(1, 1.25, day) * lerp(1, 0.65, garden * (1 - day));
      gl.toneMappingExposure = lerp(1.05, 1, day);

      // Ripples: the tail's wake while the creature swims, and the pointer on the water.
      const onWater = creatureLive.tail.y < WATER_Y + TAIL_WATER_HEIGHT;
      if (onWater && creatureLive.speed > 0.35) {
        const gap = Math.max(
          TAIL_RIPPLE_MIN_GAP,
          Math.min(TAIL_RIPPLE_MAX_GAP, 0.35 / creatureLive.speed),
        );
        if (time - book.tail > gap) {
          book.tail = time;
          addRipple(
            sceneLive.ripples,
            creatureLive.tail.x,
            creatureLive.tail.z,
            time,
          );
        }
      }
      const pointer = state.pointer;
      if (
        pointer &&
        (pointer.x !== book.pointerX || pointer.y !== book.pointerY)
      ) {
        book.pointerX = pointer.x;
        book.pointerY = pointer.y;
        if (time - book.pointer > POINTER_RIPPLE_GAP) {
          ndc.set(pointer.x, pointer.y);
          ray.setFromCamera(ndc, camera);
          if (ray.ray.intersectPlane(water, hit)) {
            book.pointer = time;
            addRipple(sceneLive.ripples, hit.x, hit.z, time);
          }
        }
      }
    },
  };
}

/** Mounts the pond's director: camera, day/night, ripples, air and the creature's environment map. */
export function Stage() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const director = useMemo(() => createDirector(), []);

  useEffect(() => installBackdrop(scene), [scene]);
  useEffect(() => installEnvironment(gl, scene), [gl, scene]);
  useFrame((state, delta) => director.update(state, delta), -2);

  return null;
}
