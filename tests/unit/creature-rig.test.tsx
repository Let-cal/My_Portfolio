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
  ...patch,
});

function camera() {
  const c = new PerspectiveCamera(40, 16 / 9, 0.1, 60);
  c.position.set(0, 3.2, 3.5);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
}

function run(rig: ReturnType<typeof createCreatureRig>, frames: number, s: SceneState, t0 = 0) {
  const cam = camera();
  for (let f = 0; f < frames; f++) rig.update({ dt: 1 / 60, time: t0 + f / 60, camera: cam, state: s });
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

  it("starts with the visitor's role pattern without a fade", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    run(rig, 1, state({ role: "techlead" }));
    expect(rig.bodyUniforms.uFade.value).toBe(1);
    expect(rig.bodyUniforms.uPrevMap.value).toBe(rig.bodyMaterial.map);
    rig.dispose();
  });
});
