import {
  BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, InstancedMesh,
  LatheGeometry, MeshStandardMaterial, Object3D, Vector2, type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../../creature/random";
import { WATER_Y } from "../constants";
import { GARDEN_LAMPS } from "../garden";
import { mapleLeafGeometry } from "./maple-grove";
import { createOwner } from "./types";

/** A low stone tōrō: broad foot, tapered shaft, open four-post firebox, flared roof and finial. */
function stoneLanternGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [
    new CylinderGeometry(0.4, 0.48, 0.16, 8).translate(0, 0.08, 0),
    new CylinderGeometry(0.12, 0.19, 0.8, 8).translate(0, 0.55, 0),
    new BoxGeometry(0.62, 0.12, 0.62).translate(0, 1.01, 0),
    new LatheGeometry([
      new Vector2(0, 1.51), new Vector2(0.5, 1.51), new Vector2(0.48, 1.57),
      new Vector2(0.34, 1.61), new Vector2(0.13, 1.83), new Vector2(0.08, 1.9),
      new Vector2(0.07, 2.01), new Vector2(0, 2.07),
    ], 8),
  ];
  for (const x of [-0.23, 0.23]) for (const z of [-0.23, 0.23]) {
    parts.push(new BoxGeometry(0.065, 0.44, 0.065).translate(x, 1.29, z));
  }
  // All parts have matching position/normal/uv attributes.
  const merged = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  return merged;
}

/** Five draw calls for both shores, foliage and three unshadowed lamps. No additional light or reflection pass. */
export function createGardenBanks(own: ReturnType<typeof createOwner>["own"], cliff: MeshStandardMaterial) {
  const root = new Group();
  root.name = "garden-banks";
  const random = mulberry32(3015), dummy = new Object3D();
  const stone = own(new MeshStandardMaterial({ color: 0x84918a, roughness: 0.94, transparent: true }));
  const rockGeo = own(new IcosahedronGeometry(1, 2));
  const vertices = rockGeo.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const scale = 1 + 0.12 * Math.sin(x * 11 + z * 7) * Math.cos(y * 9);
    vertices.setXYZ(i, x * scale, y * scale, z * scale);
  }
  rockGeo.computeVertexNormals();
  const rocks = own(new InstancedMesh(rockGeo, stone, 32));
  rocks.name = "garden-shore-stones";
  const centers: { x: number; z: number; r: number }[] = [];
  for (let i = 0; i < rocks.count; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    const z = -4.3 + k * 0.75 + (random() - 0.5) * 0.55;
    const x = side * (4.5 + Math.sin(k * 0.55) * 0.75 + (random() - 0.5) * 0.8);
    const r = 0.45 + random() * 0.45;
    centers.push({ x, z, r });
    dummy.position.set(x, WATER_Y + 0.1, z);
    dummy.rotation.set(random() * 0.3, random() * 6, random() * 0.25);
    dummy.scale.set(r * 1.4, r * 0.68, r); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
  }
  const mossMat = own(new MeshStandardMaterial({ color: 0x344f2c, roughness: 1, transparent: true }));
  const moss = own(new InstancedMesh(own(new IcosahedronGeometry(1, 1)), mossMat, 96));
  moss.name = "garden-bank-moss";
  for (let i = 0; i < moss.count; i++) {
    const { x, z, r } = centers[Math.floor(i / 3)];
    dummy.position.set(x + (random() - 0.5) * r, WATER_Y + r * 0.5, z + (random() - 0.5) * r);
    dummy.rotation.set(random() * 0.4, i * 0.7, random() * 0.3); dummy.scale.set(r * 0.52, r * 0.14, r * 0.4);
    dummy.updateMatrix(); moss.setMatrixAt(i, dummy.matrix);
  }
  const foliageMat = own(new MeshStandardMaterial({ color: 0x78966a, roughness: 0.8, side: DoubleSide, transparent: true }));
  const shrubs = own(new InstancedMesh(own(mapleLeafGeometry()), foliageMat, 512));
  shrubs.name = "garden-bank-leaves";
  for (let i = 0; i < shrubs.count; i++) {
    const center = centers[Math.floor(i / 16)];
    const side = center.x < 0 ? -1 : 1;
    dummy.position.set(center.x + side * (0.45 + random() * 0.5), WATER_Y + 0.25 + random() * 0.65, center.z + (random() - 0.5) * 1.2);
    dummy.rotation.set(-Math.PI / 2 + random() * 0.7, random() * 6, random() * 6);
    dummy.scale.setScalar(0.1 + random() * 0.12); dummy.updateMatrix(); shrubs.setMatrixAt(i, dummy.matrix);
  }
  const lanterns = own(new InstancedMesh(own(stoneLanternGeometry()), stone, GARDEN_LAMPS.length));
  lanterns.name = "garden-stone-lanterns";
  const light = own(new MeshStandardMaterial({ color: 0xb9b4a3, emissive: new Color(0xff801d), roughness: 0.6, transparent: true }));
  const windows = own(new InstancedMesh(own(new BoxGeometry(0.38, 0.34, 0.38)), light, GARDEN_LAMPS.length));
  windows.name = "garden-lantern-windows";
  GARDEN_LAMPS.forEach(([x, z], i) => {
    dummy.rotation.set(0, 0.3 + i * 0.7, 0); dummy.scale.setScalar(1);
    dummy.position.set(x, WATER_Y + 0.3, z); dummy.updateMatrix(); lanterns.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 1.29; dummy.updateMatrix(); windows.setMatrixAt(i, dummy.matrix);
  });
  for (const batch of [rocks, moss, shrubs, lanterns, windows]) { batch.computeBoundingSphere(); root.add(batch); }
  const nightStone = new Color(0x526d7b), dayStone = new Color(0x7b8176);
  const nightGreen = new Color(0x344c48), dayGreen = new Color(0x78966a);
  const nightPaper = new Color(0x6e3c1a), dayPaper = new Color(0xb9b4a3);
  return { root, update(weight: number, day: number) {
    // Share the already-deferred PBR surface maps; no extra texture request or ownership.
    if (cliff.map && stone.map !== cliff.map) {
      stone.map = cliff.map; stone.normalMap = cliff.normalMap; stone.normalScale.set(0.45, 0.45); stone.needsUpdate = true;
    }
    if (stone.normalMap !== cliff.normalMap) { stone.normalMap = cliff.normalMap; stone.needsUpdate = true; }
    stone.opacity = mossMat.opacity = foliageMat.opacity = light.opacity = weight;
    stone.color.copy(nightStone).lerp(dayStone, day);
    foliageMat.color.copy(nightGreen).lerp(dayGreen, day);
    light.color.copy(nightPaper).lerp(dayPaper, day);
    light.emissiveIntensity = (1 - day) * 1.7;
  } };
}
