import { PerspectiveCamera, type BufferAttribute, type Object3D } from "three";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCreatureRig } from "@/scene/creature/rig";
import { creatureLive } from "@/scene/creature/live";
import type { SceneState } from "@/scene/store";

// jsdom has no 2D canvas: textures stay blank, which is all this test needs (it checks the simulation, not pixels).
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterAll(() => vi.restoreAllMocks());

const state = (patch: Partial<SceneState> = {}): SceneState => ({
  chapter: 0,
  t: 0,
  pointer: null,
  theme: "dark",
  role: "fullstack",
  tier: "high",
  foods: [],
  avoid: [],
  drop: null,
  ...patch,
});

function camera() {
  const c = new PerspectiveCamera(40, 16 / 9, 0.1, 60);
  c.position.set(0, 3.2, 3.5);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
}

function run(
  rig: ReturnType<typeof createCreatureRig>,
  frames: number,
  s: SceneState,
  t0 = 0,
  extra: { day?: number; viewport?: { width: number; height: number } } = {},
) {
  const cam = camera();
  for (let f = 0; f < frames; f++) rig.update({ dt: 1 / 60, time: t0 + f / 60, camera: cam, state: s, ...extra });
  return t0 + frames / 60;
}

const byName = (rig: ReturnType<typeof createCreatureRig>) => rig.root.children as Object3D[];

describe("creature rig", () => {
  it("swims its head onto the pointer's spot on the water", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    // NDC (0, 0) is the centre of the screen; the camera looks at the pond origin.
    let t = 0;
    for (let i = 0; i < 6; i++) t = run(rig, 60, state({ pointer: { x: 0, y: i % 2 ? 0 : 1e-6 } }), t);
    const { x, z } = creatureLive.head;
    expect(Math.hypot(x, z)).toBeLessThan(0.35);
    rig.dispose();
  });

  it("keeps every body vertex finite while swimming, morphing and changing role", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    let t = run(rig, 120, state());
    t = run(rig, 120, state({ chapter: 5, t: 0.5, role: "techlead" }), t);
    run(rig, 120, state({ chapter: 6, role: "pm", pointer: { x: 0.4, y: -0.3 } }), t);
    const pos = rig.bodyGeometry.getAttribute("position") as BufferAttribute;
    for (let k = 0; k < pos.array.length; k++) expect(Number.isFinite(pos.array[k])).toBe(true);
    rig.dispose();
  });

  it("eases into the dragon from chapter 5 on: fins fold away, spines and legs appear", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    let t = run(rig, 30, state());
    expect(rig.morph).toBe(0);
    const instanced = () => byName(rig).filter((o) => (o as { isInstancedMesh?: boolean }).isInstancedMesh);
    // Eyes are always on; the five dragon-only parts are hidden.
    expect(instanced().filter((o) => o.visible)).toHaveLength(1);
    t = run(rig, 6, state({ chapter: 6 }), t);
    expect(rig.morph).toBeGreaterThan(0);
    expect(rig.morph).toBeLessThan(0.5);
    run(rig, 240, state({ chapter: 6 }), t);
    expect(rig.morph).toBe(1);
    expect(instanced().every((o) => o.visible)).toBe(true);
    const fins = byName(rig).filter((o) => (o as { material?: { transparent?: boolean } }).material?.transparent && o.type === "Mesh");
    expect(fins.length).toBeGreaterThan(0);
    expect(fins.every((o) => !o.visible)).toBe(true);
    expect(rig.bodyUniforms.uMorph.value).toBe(1);
    rig.dispose();
  });

  it("cross-fades the koi pattern over 600 ms when the role changes", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    let t = run(rig, 10, state({ role: "fullstack" }));
    const kohaku = rig.bodyMaterial.map;
    expect(rig.bodyUniforms.uFade.value).toBe(1);
    t = run(rig, 1, state({ role: "pm" }), t);
    expect(rig.bodyMaterial.map).not.toBe(kohaku);
    expect(rig.bodyUniforms.uPrevMap.value).toBe(kohaku);
    expect(rig.bodyUniforms.uFade.value).toBeGreaterThan(0);
    expect(rig.bodyUniforms.uFade.value).toBeLessThan(0.1);
    t = run(rig, 17, state({ role: "pm" }), t);
    expect(rig.bodyUniforms.uFade.value).toBeGreaterThan(0.2);
    expect(rig.bodyUniforms.uFade.value).toBeLessThan(0.8);
    run(rig, 20, state({ role: "pm" }), t);
    expect(rig.bodyUniforms.uFade.value).toBe(1);
    rig.dispose();
  });

  it("swims to the nearest pellet that has landed, before the pointer, and ignores one still falling", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    const pointer = { x: 0.9, y: 0.4 };
    // A pellet is still in the air (it drops far in the future), the pointer is far to the right: the pointer wins.
    let t = 0;
    const falling = [{ id: 1, x: -1.5, z: 0.5, t0: 1000 }];
    for (let i = 0; i < 4; i++) t = run(rig, 30, state({ pointer: { x: pointer.x, y: pointer.y - (i % 2) * 1e-6 }, foods: falling }), t);
    expect(creatureLive.head.x).toBeGreaterThan(0);
    // Once it has landed the koi goes for it, though the pointer is still moving.
    const landed = [{ id: 1, x: -1.5, z: 0.5, t0: 0 }];
    for (let i = 0; i < 8; i++) t = run(rig, 30, state({ pointer: { x: pointer.x, y: pointer.y - (i % 2) * 1e-6 }, foods: landed }), t);
    expect(Math.hypot(creatureLive.head.x + 1.5, creatureLive.head.z - 0.5)).toBeLessThan(0.3);
    rig.dispose();
  });

  it("fades while its body is under a block of text, and shows where it is on screen", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    const viewport = { width: 1280, height: 720 };
    // The whole screen is "text".
    const cover = [{ x0: 0, y0: 0, x1: 1280, y1: 720 }];
    const t = run(rig, 90, state({ avoid: cover }), 0, { viewport });
    expect(creatureLive.visibility).toBeLessThan(0.4);
    expect(rig.bodyMaterial.emissiveIntensity).toBeLessThan(0.5);
    expect(creatureLive.screen.valid).toBe(true);
    expect(creatureLive.screen.x1).toBeGreaterThan(creatureLive.screen.x0);
    // The text goes away: it comes back.
    run(rig, 120, state({ avoid: [] }), t, { viewport });
    expect(creatureLive.visibility).toBeGreaterThan(0.95);
    rig.dispose();
  });

  it("glows less by day, following the blend it is given rather than the theme", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    run(rig, 30, state(), 0, { day: 0 });
    const night = rig.bodyMaterial.emissiveIntensity;
    run(rig, 30, state(), 0, { day: 1 });
    const day = rig.bodyMaterial.emissiveIntensity;
    expect(day).toBeLessThan(night * 0.8);
    rig.dispose();
  });

  it("starts with the visitor's role pattern without a fade", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    run(rig, 1, state({ role: "techlead" }));
    expect(rig.bodyUniforms.uFade.value).toBe(1);
    expect(rig.bodyUniforms.uPrevMap.value).toBe(rig.bodyMaterial.map);
    rig.dispose();
  });
});
