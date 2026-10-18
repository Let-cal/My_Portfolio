import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  SRGBColorSpace,
} from "three";
import { mulberry32 } from "../../creature/random";
import { WATER_Y } from "../constants";
import { gardenWeight } from "../garden";
import { propWeight } from "../math";
import { createOwner, type Prop } from "./types";

const LEAVES = 10;
const FLOWERS = 3;
/** Petals per flower: an outer ring leaning out and an inner ring standing nearly upright. */
const OUTER = 9;
const INNER = 6;
const PETALS = OUTER + INNER;

/** A round lily pad with a notch, cupped upwards at the rim. Lies flat on the water. */
export function leafGeometry(): BufferGeometry {
  const g = new CircleGeometry(1, 44, 0.32, Math.PI * 2 - 0.64);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    pos.setY(i, r * r * 0.16);
  }
  g.computeVertexNormals();
  return g;
}

/** Radial veins on a green disc; drawn on the circle's uv (centre at 0.5, 0.5). */
function veinTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  const grad = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grad.addColorStop(0, "#2a6a49");
  grad.addColorStop(1, "#3f8d62");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(190, 235, 200, 0.45)";
  g.lineWidth = 1.6;
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    g.beginPath();
    g.moveTo(128, 128);
    g.lineTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Chapter 2, the lotus pond: lily pads drifting on the water, and a few lotus flowers among them. */
export function createLotus(): Prop {
  const { own, disposeAll } = createOwner();
  const root = new Group();
  root.name = "lotus";

  const rand = mulberry32(2026);
  const leaves = Array.from({ length: LEAVES }, () => ({
    x: (rand() - 0.5) * 8,
    z: -2.6 + rand() * 4.2,
    r: 0.45 + rand() * 0.45,
    rot: rand() * Math.PI * 2,
    seed: rand(),
    spin: (rand() - 0.5) * 0.12,
  }));

  const map = veinTexture();
  if (map) own(map);
  const leafMat = own(
    new MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.55, metalness: 0, side: DoubleSide, transparent: true }),
  );
  const leafMesh = new InstancedMesh(own(leafGeometry()), leafMat, LEAVES);
  leafMesh.frustumCulled = false;
  const tint = new Color();
  for (let i = 0; i < LEAVES; i++) {
    const s = leaves[i].seed - 0.5;
    leafMesh.setColorAt(i, tint.setHSL(0.36 + s * 0.06, 0.45, 0.55 + s * 0.2));
  }
  root.add(leafMesh);

  // Flowers: petals are squashed spheres standing on their base.
  const petalGeo = own(new SphereGeometry(1, 12, 8).scale(0.075, 0.2, 0.04).translate(0, 0.2, 0));
  const petalMat = own(
    new MeshStandardMaterial({
      color: 0xf7cfdc,
      emissive: new Color(0xff9ab8),
      emissiveIntensity: 0.12,
      roughness: 0.5,
      side: DoubleSide,
      transparent: true,
    }),
  );
  const petals = new InstancedMesh(petalGeo, petalMat, FLOWERS * PETALS);
  petals.frustumCulled = false;
  const heartGeo = own(new SphereGeometry(0.06, 12, 8));
  const heartMat = own(
    new MeshStandardMaterial({
      color: 0xf2b84b,
      emissive: new Color(0xf2a030),
      emissiveIntensity: 0.6,
      roughness: 0.4,
      transparent: true,
    }),
  );
  const hearts = new InstancedMesh(heartGeo, heartMat, FLOWERS);
  hearts.frustumCulled = false;
  const flowerSpots = [
    { x: -2.6, z: -1.2 },
    { x: 2.4, z: -2.0 },
    { x: 0.9, z: 1.0 },
  ];
  const dummy = new Object3D();
  const euler = new Euler(0, 0, 0, "YXZ");
  for (let f = 0; f < FLOWERS; f++) {
    const { x, z } = flowerSpots[f];
    for (let p = 0; p < PETALS; p++) {
      const outer = p < OUTER;
      const n = outer ? OUTER : INNER;
      const k = outer ? p : p - OUTER;
      const lean = outer ? 1.05 : 0.5;
      euler.set(0, (k / n) * Math.PI * 2 + (outer ? 0 : 0.35) + f, -lean);
      dummy.quaternion.setFromEuler(euler);
      dummy.position.set(x, WATER_Y + 0.05, z);
      const s = outer ? 1 : 0.8;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      petals.setMatrixAt(f * PETALS + p, dummy.matrix);
    }
    dummy.quaternion.identity();
    dummy.position.set(x, WATER_Y + 0.12, z);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    hearts.setMatrixAt(f, dummy.matrix);
  }
  petals.instanceMatrix.needsUpdate = true;
  hearts.instanceMatrix.needsUpdate = true;
  root.add(petals, hearts);

  function update(time: number, pos: number, day: number) {
    const w = Math.max(propWeight(pos, 2), gardenWeight(pos));
    root.visible = w > 0.01;
    if (!root.visible) return;
    leafMat.opacity = w;
    petalMat.opacity = w;
    heartMat.opacity = w;
    // At night the pads are dim, by day bright; the flowers glow a little in the dark.
    leafMat.color.setScalar(0.5 + 0.5 * day);
    petalMat.emissiveIntensity = 0.1 + 0.28 * (1 - day);
    heartMat.emissiveIntensity = 0.35 + 0.55 * (1 - day);
    for (let i = 0; i < LEAVES; i++) {
      const l = leaves[i];
      dummy.position.set(
        l.x + Math.sin(time * 0.12 + l.seed * 6.3) * 0.28,
        WATER_Y + 0.02 + Math.sin(time * 0.8 + l.seed * 9) * 0.008,
        l.z + Math.cos(time * 0.1 + l.seed * 5.1) * 0.22,
      );
      dummy.quaternion.setFromEuler(euler.set(Math.sin(time * 0.5 + l.seed * 7) * 0.015, l.rot + time * l.spin, 0));
      // The same leaves remain in the same pond when the camera rises towards Skills.
      dummy.scale.setScalar(l.r);
      dummy.updateMatrix();
      leafMesh.setMatrixAt(i, dummy.matrix);
    }
    leafMesh.instanceMatrix.needsUpdate = true;
  }

  return {
    root,
    update,
    dispose() {
      leafMesh.dispose();
      petals.dispose();
      hearts.dispose();
      disposeAll();
    },
  };
}
