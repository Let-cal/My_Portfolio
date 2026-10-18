import { describe, expect, it } from "vitest";
import { Color, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, ShaderMaterial, Vector3 } from "three";
import { cameraAtPosition, CHAPTER_CAMERA } from "@/scene/chapters";
import { createLotus } from "@/scene/environment/props/lotus";
import { createWaterfall, FALL_Z } from "@/scene/environment/props/waterfall";
import { WATER_Y } from "@/scene/environment/constants";
import { smoothstep } from "@/scene/environment/math";

const pose = () => ({ pos: new Vector3(), look: new Vector3() });

describe("one Japanese garden from Projects to Skills", () => {
  it("uses the approved sRGB obsidian horizon and sky, decoded once for the sky shader", () => {
    const waterfall = createWaterfall();
    const glslColor = (hex: string) => `vec3(${new Color(hex).toArray().map((n) => n.toFixed(7)).join(", ")})`;
    try {
      const sky = waterfall.root.getObjectByName("garden-sky") as Mesh;
      const shader = (sky.material as ShaderMaterial).fragmentShader;
      expect(shader).toContain(glslColor("#0b1318"));
      expect(shader).toContain(glslColor("#04070b"));
      expect(shader).toContain("vec3(0.94, 0.78, 0.57)");
    } finally { waterfall.dispose(); }
  });

  it("uses silver foam and deep obsidian water at night without changing daylight foam", () => {
    const waterfall = createWaterfall();
    const glslColor = (hex: string) => `vec3(${new Color(hex).toArray().map((n) => n.toFixed(7)).join(", ")})`;
    try {
      const fall = waterfall.root.getObjectByName("waterfall-cascade") as Mesh;
      const shader = (fall.material as ShaderMaterial).fragmentShader;
      expect(shader).toContain(glslColor("#6b828a"));
      expect(shader).toContain(glslColor("#101e26"));
      expect(shader).toContain("vec3(1.0, 0.97, 0.88)");
    } finally { waterfall.dispose(); }
  });

  it("keeps the same lotus instances, opacity and size throughout the transition, in both themes", () => {
    const lotus = createLotus();
    try {
      const leaves = lotus.root.children.find((node) => node instanceof InstancedMesh) as InstancedMesh;
      const before = new Matrix4(), after = new Matrix4();
      lotus.update(2, 2, 1);
      leaves.getMatrixAt(0, before);
      for (const day of [0, 0.5, 1]) {
        for (const position of [2.2, 2.5, 2.9, 3, 3.25]) {
          lotus.update(2, position, day);
          expect(lotus.root.visible).toBe(true);
          expect((leaves.material as MeshStandardMaterial).opacity).toBe(1);
          leaves.getMatrixAt(0, after);
          expect(after.elements).toEqual(before.elements);
        }
      }
      lotus.update(2, 4.2, 0);
      expect(lotus.root.visible).toBe(false);
    } finally { lotus.dispose(); }
  });

  it("uses a curved, reversible camera path and preserves all chapter endpoints", () => {
    for (let chapter = 0; chapter < CHAPTER_CAMERA.length; chapter++) {
      const value = pose(); cameraAtPosition(chapter, value);
      expect(value.pos.toArray()).toEqual(CHAPTER_CAMERA[chapter].pos);
      expect(value.look.toArray()).toEqual(CHAPTER_CAMERA[chapter].look);
    }
    const middle = pose(); cameraAtPosition(2.5, middle);
    const straight = new Vector3(...CHAPTER_CAMERA[2].pos).lerp(new Vector3(...CHAPTER_CAMERA[3].pos), 0.5);
    expect(middle.pos.distanceTo(straight)).toBeGreaterThan(0.1);
    const forward = Array.from({ length: 81 }, (_, i) => { const p = pose(); cameraAtPosition(2 + i / 40, p); return p; });
    for (let i = 80; i >= 0; i--) {
      const reverse = pose(); cameraAtPosition(2 + i / 40, reverse);
      expect(reverse.pos.toArray()).toEqual(forward[i].pos.toArray());
      if (i > 0) expect(reverse.pos.distanceTo(forward[i - 1].pos)).toBeLessThan(0.6);
      expect(reverse.pos.y).toBeGreaterThan(1.5);
    }
  });

  it("keeps the waterfall present across the pond and lights three stone lanterns only at night", () => {
    const waterfall = createWaterfall();
    try {
      waterfall.update(1, 2.5, 1);
      const cascade = waterfall.root.getObjectByName("waterfall-cascade") as Mesh;
      expect((cascade.material as ShaderMaterial).uniforms.uOpacity.value).toBe(1);
      const windows = waterfall.root.getObjectByName("garden-lantern-windows") as InstancedMesh;
      expect(windows).toBeInstanceOf(InstancedMesh);
      expect(windows.count).toBe(3);
      expect(waterfall.root.getObjectByName("garden-shore-stones")).toBeInstanceOf(InstancedMesh);
      const sky = waterfall.root.getObjectByName("garden-sky") as Mesh;
      expect(sky).toBeInstanceOf(Mesh);
      expect((sky.material as ShaderMaterial).uniforms.uDay.value).toBe(1);
      // Transparent objects draw after opaque water: the sky must respect the pond's depth.
      expect((sky.material as ShaderMaterial).depthTest).toBe(true);
      const celestial = waterfall.root.getObjectByName("garden-sun-moon") as Mesh;
      const celestialPosition = celestial.position.clone();
      const light = windows.material as MeshStandardMaterial;
      expect(light.emissiveIntensity).toBeLessThan(0.1);
      waterfall.update(1, 3, 0);
      expect(light.emissiveIntensity).toBeGreaterThan(1);
      expect((sky.material as ShaderMaterial).uniforms.uDay.value).toBe(0);
      expect(celestial.position.toArray()).toEqual(celestialPosition.toArray());
      let pointLights = 0;
      waterfall.root.traverse((node) => { if ("isPointLight" in node) pointLights++; });
      expect(pointLights).toBe(0);
    } finally { waterfall.dispose(); }
  });

  it("keeps the displaced cliff behind the cascade at the same world height", () => {
    const waterfall = createWaterfall();
    try {
      const cliff = waterfall.root.getObjectByName("waterfall-cliff") as Mesh;
      const cascade = waterfall.root.getObjectByName("waterfall-cascade") as Mesh;
      const height = cascade.geometry.boundingBox ?? (cascade.geometry.computeBoundingBox(), cascade.geometry.boundingBox!);
      const fallHeight = height.max.y - height.min.y;
      const vertices = cliff.geometry.getAttribute("position");
      let minimumClearance = Infinity;
      for (let i = 0; i < vertices.count; i++) {
        const y = vertices.getY(i) + cliff.position.y - WATER_Y;
        if (y < 0 || y > fallHeight || Math.abs(vertices.getX(i)) > 1) continue;
        const t = y / fallHeight;
        const surfaceZ = FALL_Z + 0.6 + 0.75 * (1 - smoothstep(0.6, 0.7, t)) + (1 - smoothstep(0.25, 0.35, t));
        minimumClearance = Math.min(minimumClearance, surfaceZ - (vertices.getZ(i) + cliff.position.z));
      }
      expect(minimumClearance).toBeGreaterThan(0.25);
    } finally { waterfall.dispose(); }
  });
});
