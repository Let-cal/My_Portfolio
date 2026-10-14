import { InstancedBufferGeometry, PerspectiveCamera, type BufferAttribute, type ShaderMaterial } from "three";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPointCloud, cloudQualityForTier } from "@/scene/creature/PointCloudMorph";
import { createCreatureRig } from "@/scene/creature/rig";
import type { SceneState } from "@/scene/store";

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
  cta: null,
  ...patch,
});

function drive(rig: ReturnType<typeof createCreatureRig>, frames: number, s: SceneState, t0 = 0) {
  const cam = new PerspectiveCamera(40, 16 / 9, 0.1, 60);
  cam.position.set(0, 3.2, 3.5);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  for (let f = 0; f < frames; f++) rig.update({ dt: 1 / 60, time: t0 + f / 60, camera: cam, state: s });
  return t0 + frames / 60;
}

describe("point cloud", () => {
  it("is built from the very same buffers as the body, so it starts exactly where the koi is", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    const cloud = createPointCloud(rig, "high");
    const g = cloud.points.geometry;
    expect(g.getAttribute("position")).toBe(rig.bodyGeometry.getAttribute("position"));
    expect(g.getAttribute("aRand")).toBe(rig.bodyGeometry.getAttribute("aRand"));
    expect(g.getAttribute("uv")).toBe(rig.bodyGeometry.getAttribute("uv"));
    expect(g.getIndex()).not.toBeNull();
    cloud.dispose();
    rig.dispose();
  });

  it("draws every point in a few layers on high and fewer points on low", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    const high = createPointCloud(rig, "high");
    const low = createPointCloud(rig, "low");
    const count = (c: typeof high) => c.points.geometry.getIndex()!.count * (c.points.geometry as InstancedBufferGeometry).instanceCount;
    expect(count(low)).toBeLessThan(count(high) * 0.6);
    expect(count(low)).toBeGreaterThan(0);
    expect(cloudQualityForTier("low").stride).toBeGreaterThan(cloudQualityForTier("high").stride);
    high.dispose();
    low.dispose();
    rig.dispose();
  });

  it("is hidden while the creature is whole and shown, with the scatter, while it is a cloud", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    const cloud = createPointCloud(rig, "high");
    const mat = cloud.points.material as ShaderMaterial;
    let t = drive(rig, 30, state({ chapter: 4, t: 1 }));
    cloud.update(rig, t, { day: 0, pixelHeight: 1000 });
    expect(cloud.points.visible).toBe(false);
    for (let i = 0; i < 180; i++) t = drive(rig, 1, state({ chapter: 5, t: 0.5 }), t);
    cloud.update(rig, t, { day: 0, pixelHeight: 1000 });
    expect(cloud.points.visible).toBe(true);
    expect(mat.uniforms.uScatter.value).toBeGreaterThan(0.95);
    expect(mat.uniforms.uMorph.value).toBeCloseTo(0.5, 2);
    expect(mat.uniforms.uViewH.value).toBe(1000);
    expect(mat.uniforms.uMap.value).toBe(rig.bodyMaterial.map);
    // The dragon is whole again.
    t = drive(rig, 500, state({ chapter: 6 }), t);
    cloud.update(rig, t, { day: 0, pixelHeight: 1000 });
    expect(cloud.points.visible).toBe(false);
    cloud.dispose();
    rig.dispose();
  });

  it("frees its geometry and material, and only its own (the body's buffers belong to the rig)", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    const cloud = createPointCloud(rig, "high");
    const geoSpy = vi.spyOn(cloud.points.geometry, "dispose");
    const matSpy = vi.spyOn(cloud.points.material as ShaderMaterial, "dispose");
    cloud.dispose();
    expect(geoSpy).toHaveBeenCalledTimes(1);
    expect(matSpy).toHaveBeenCalledTimes(1);
    rig.dispose();
  });

  it("does not allocate on update (it only writes uniforms)", () => {
    const rig = createCreatureRig({ rings: 40, sides: 10 });
    const cloud = createPointCloud(rig, "high");
    const mat = cloud.points.material as ShaderMaterial;
    const uniforms = mat.uniforms;
    const scatter = mat.uniforms.uScatter;
    cloud.update(rig, 1, { day: 1, pixelHeight: 800 });
    cloud.update(rig, 2, { day: 1, pixelHeight: 800 });
    expect(mat.uniforms).toBe(uniforms);
    expect(mat.uniforms.uScatter).toBe(scatter);
    expect((cloud.points.geometry.getAttribute("position") as BufferAttribute).array.length).toBeGreaterThan(0);
    cloud.dispose();
    rig.dispose();
  });
});
