import { describe, expect, it } from "vitest";
import { InstancedMesh, Mesh } from "three";
import { createWaterfall } from "@/scene/environment/props/waterfall";

describe("waterfall landscape", () => {
  it("grounds the falling water with rocks, foliage and a landing basin in a bounded draw-call count", () => {
    const prop = createWaterfall();
    try {
      expect(prop.root.getObjectByName("waterfall-rocks")).toBeInstanceOf(InstancedMesh);
      expect(prop.root.getObjectByName("waterfall-foliage")).toBeInstanceOf(InstancedMesh);
      expect(prop.root.getObjectByName("waterfall-basin")).toBeDefined();
      let meshes = 0;
      prop.root.traverse((node) => { if ("isMesh" in node) meshes++; });
      // Shared 3D sky, shores and three stone lanterns add seven batches, never per-lamp lights.
      expect(meshes).toBeLessThanOrEqual(17);
      const cascade=prop.root.getObjectByName("waterfall-cascade") as Mesh;
      const depth=cascade.geometry.getAttribute("position");
      const values=Array.from({length: depth.count},(_,i)=>depth.getZ(i));
      expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(1.5);
      prop.update(1, 3, 1);
      expect(prop.root.visible).toBe(true);
      prop.update(2, 0, 0);
      expect(prop.root.visible).toBe(false);
    } finally { prop.dispose(); }
  });
});
