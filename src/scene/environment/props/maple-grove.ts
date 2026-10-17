import { BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, TubeGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../../creature/random";
import { WATER_Y } from "../constants";
import { createOwner } from "./types";

/** Folded five-lobed maple leaf, actual double-sided geometry rather than a foliage billboard. */
export function mapleLeafGeometry() {
  const vertices: number[] = [];
  const outline = Array.from({ length: 30 }, (_, i) => {
    const angle = i / 30 * Math.PI * 2;
    const radius = i % 6 === 0 ? 1 : i % 6 === 3 ? 0.35 : 0.62;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, radius * radius * 0.09];
  });
  for (let i = 0; i < outline.length; i++) vertices.push(0, 0, 0, ...outline[i], ...outline[(i + 1) % outline.length]);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(vertices, 3)); geo.computeVertexNormals();
  return geo;
}

/** Curved trunks, branching limbs and hundreds of individual autumn maple leaves. */
export function createMapleGrove(own: ReturnType<typeof createOwner>["own"], z: number) {
  const root = new Group(), random = mulberry32(8123), segments: BufferGeometry[] = [];
  const tips: Vector3[] = [];
  for (const side of [-1, 1]) {
    for (let tree = 0; tree < 2; tree++) {
      const x = side * (5.8 + tree * 2.4), height = 5.3 + random() * 1.6, depth = z + 2.6 - tree * 0.6;
      const base = new Vector3(x, WATER_Y, depth);
      const top = new Vector3(x - side * 1.2, height, depth - 0.4);
      segments.push(new TubeGeometry(new CatmullRomCurve3([base, new Vector3(x + side * 0.4, height * 0.45, depth), top]), 12, 0.13 - tree * 0.025, 7, false));
      for (let branch = 0; branch < 7; branch++) {
        const y = height * (0.48 + branch * 0.065);
        const start = new Vector3(x - side * (y / height), y, depth);
        const end = new Vector3(start.x + (branch % 2 ? side : -side) * (1.2 + random() * 1.5), y + 0.4 + random() * 0.6, depth + (random() - 0.5) * 2.4);
        const middle = start.clone().lerp(end, 0.6); middle.y += 0.25;
        segments.push(new TubeGeometry(new CatmullRomCurve3([start, middle, end]), 7, 0.035, 5, false));
        tips.push(end);
      }
    }
  }
  const woodMat = own(new MeshStandardMaterial({ color: 0x594237, roughness: 0.85, transparent: true }));
  const leafMat = own(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, side: DoubleSide, transparent: true }));
  const merged = own(mergeGeometries(segments)!); segments.forEach((geo) => geo.dispose());
  const wood = new Mesh(merged, woodMat); wood.name = "waterfall-maple-branches";
  const leaves = own(new InstancedMesh(own(mapleLeafGeometry()), leafMat, tips.length * 36));
  leaves.name = "waterfall-foliage";
  const dummy = new Object3D(), colors = [0x7a904f, 0x9a9b50, 0xb67c40, 0x536a42].map((hex) => new Color(hex));
  for (let i = 0; i < leaves.count; i++) {
    const tip = tips[Math.floor(i / 36)];
    dummy.position.set(tip.x + (random() - 0.5) * 2, tip.y + (random() - 0.5) * 0.65, tip.z + (random() - 0.5) * 1.8);
    dummy.rotation.set(-Math.PI / 2 + (random() - 0.5) * 1.2, random() * Math.PI, random() * Math.PI);
    dummy.scale.setScalar(0.18 + random() * 0.12); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    leaves.setColorAt(i, colors[Math.floor(random() * colors.length)]);
  }
  leaves.computeBoundingSphere(); root.add(wood, leaves);
  const night = new Color(0x4c6571), white = new Color(0xffffff);
  return { root, update(weight: number, day: number, time: number) {
    woodMat.opacity = weight; leafMat.opacity = weight;
    leafMat.color.copy(night).lerp(white, day);
    leaves.rotation.z = Math.sin(time * 0.42) * 0.002;
  } };
}
