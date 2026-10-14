import {
  Color,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Plane,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
  type Camera,
} from "three";
import type { SoundKind } from "@/components/fx/sound";
import { creatureLive } from "../creature/live";
import { clamp } from "../creature/profiles";
import { minTurnRadius, pondLimits, REF_ASPECT, type PondLimits } from "../creature/spine";
import { WATER_Y } from "../environment/constants";
import { sceneLive } from "../environment/live";
import { addRipple } from "../environment/ripples";
import { sceneStore } from "../store";
import { addFood, EAT_RADIUS, eatFood, FOOD_FALL_SECONDS, FOOD_LIFETIME_SECONDS, MAX_FOOD, pruneFood } from "./feed";

/** Pellets dropped by one click (spec 6, item 9: one to three). */
const PER_CLICK = 3;
/** Where a pellet starts its fall, above the water. */
const DROP_HEIGHT = 1.3;
/** Pellets of one click land this far apart (pond units) and this long after each other (seconds). */
const SCATTER = 0.24;
const STAGGER = 0.11;
const SINK_SECONDS = 2;

/**
 * The fish food. A click on the hero's water (turned into a drop request by `useFeedClicks`) is raycast onto the
 * water and becomes one to three pellets that fall, splash (ripples, and the "drop" sound when sound is on) and
 * float. The koi swims to the nearest landed pellet and eats it when its snout gets close (see the creature rig).
 * Pellets nobody eats sink after a while. The pellets live in the scene store and are drawn by one instanced mesh;
 * nothing allocates per frame while the water is empty, and no React state changes.
 */
export function createFeeder() {
  const geometry = new SphereGeometry(0.05, 14, 10);
  const material = new MeshStandardMaterial({
    color: 0xe8b878,
    emissive: new Color(0xff8a3d),
    emissiveIntensity: 1.7,
    roughness: 0.5,
  });
  const mesh = new InstancedMesh(geometry, material, MAX_FOOD);
  mesh.frustumCulled = false;
  mesh.count = 0;

  const ray = new Raycaster();
  const water = new Plane(new Vector3(0, 1, 0), -WATER_Y);
  const hit = new Vector3();
  const ndc = new Vector2();
  const dummy = new Object3D();
  const limits: PondLimits = { idleX: 0, idleZ: 0, pointerX: 0, zMin: 0, zMax: 0 };
  const landed = new Set<number>();
  let lastDrop = 0;

  function drop(camera: Camera, now: number) {
    const request = sceneStore.getState().drop;
    if (!request || request.id === lastDrop) return;
    lastDrop = request.id;
    ndc.set(request.x, request.y);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(water, hit)) return;
    const aspect = (camera as { aspect?: number }).aspect || REF_ASPECT;
    pondLimits(aspect, creatureLive.morph, limits);
    let foods = sceneStore.getState().foods;
    const n = 1 + Math.floor(Math.random() * PER_CLICK);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : SCATTER * (0.5 + Math.random() * 0.5);
      foods = addFood(
        foods,
        {
          x: clamp(hit.x + Math.cos(a) * r, -limits.pointerX, limits.pointerX),
          z: clamp(hit.z + Math.sin(a) * r, limits.zMin, limits.zMax),
        },
        now + i * STAGGER,
      );
    }
    sceneStore.setState({ foods });
  }

  return {
    mesh,
    update(camera: Camera, now: number, play: (kind: SoundKind) => void) {
      drop(camera, now);

      const state = sceneStore.getState();
      let foods = state.foods;
      if (foods.length === 0) {
        mesh.count = 0;
        if (landed.size) landed.clear();
        return;
      }

      // A pellet touching the water makes a ripple and a drop sound, once.
      for (let i = 0; i < foods.length; i++) {
        const f = foods[i];
        if (now - f.t0 >= FOOD_FALL_SECONDS && !landed.has(f.id)) {
          landed.add(f.id);
          addRipple(sceneLive.ripples, f.x, f.z, now);
          play("drop");
        }
      }

      // The koi eats what its snout reaches (only pellets that have landed), and the uneaten ones sink in time.
      const reach = Math.max(EAT_RADIUS, 0.5 * minTurnRadius(creatureLive.morph));
      const afterMeal = eatFood(foods, creatureLive.head, reach, now);
      if (afterMeal !== foods) {
        // A small splash where each pellet was.
        for (let i = 0; i < foods.length; i++) {
          if (!afterMeal.includes(foods[i])) addRipple(sceneLive.ripples, foods[i].x, foods[i].z, now);
        }
      }
      const left = pruneFood(afterMeal, now);
      if (left !== state.foods) {
        sceneStore.setState({ foods: left });
        // Forget the pellets that are gone, so the set never outgrows the pellets on the water.
        for (const id of landed) if (!left.some((f) => f.id === id)) landed.delete(id);
      }
      foods = left;

      // Draw them.
      for (let i = 0; i < foods.length; i++) {
        const f = foods[i];
        const age = now - f.t0;
        let y: number;
        let s = 1;
        if (age < 0) {
          // Scheduled for a moment from now (a later pellet of the same click): not there yet.
          y = WATER_Y + DROP_HEIGHT;
          s = 0;
        } else if (age < FOOD_FALL_SECONDS) {
          const p = age / FOOD_FALL_SECONDS;
          y = WATER_Y + 0.05 + DROP_HEIGHT * (1 - p * p);
        } else {
          y = WATER_Y + 0.045 + Math.sin(now * 2.2 + f.id) * 0.008;
          s = 1 + 0.06 * Math.sin(now * 3 + f.id);
        }
        const sink = FOOD_LIFETIME_SECONDS - age;
        if (sink < SINK_SECONDS) {
          s *= Math.max(0, sink / SINK_SECONDS);
          y -= (1 - Math.max(0, sink / SINK_SECONDS)) * 0.08;
        }
        dummy.position.set(f.x, y, f.z);
        dummy.scale.setScalar(Math.max(s, 1e-4));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = foods.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
