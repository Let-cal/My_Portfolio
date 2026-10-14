import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { GATE_Z } from "../../creature/spine";
import { WATER_Y } from "../constants";
import { propWeight } from "../math";
import { createOwner, type Prop } from "./types";

const CHAPTER = 5;
const PILLAR_X = 2.5;
const PILLAR_H = 2.5;

/**
 * Chapter 5, the gate the koi swims through on its way to becoming a dragon: a torii, lacquered dark with thin
 * glowing circuit lines running along it (the same orange as the creature's traces).
 */
export function createGate(): Prop {
  const { own, disposeAll } = createOwner();
  const root = new Group();
  root.name = "gate";
  root.position.set(0, WATER_Y, GATE_Z);

  const lacquer = own(new MeshStandardMaterial({ color: 0x4a120a, roughness: 0.42, metalness: 0.25, transparent: true }));
  const black = own(new MeshStandardMaterial({ color: 0x0e0c0c, roughness: 0.5, metalness: 0.2, transparent: true }));
  const trace = own(
    new MeshStandardMaterial({ color: 0x2a1006, emissive: new Color(0xff7a2a), emissiveIntensity: 2.2, roughness: 0.5, transparent: true }),
  );
  const mats = [lacquer, black, trace];

  const add = (geo: BoxGeometry | CylinderGeometry, mat: MeshStandardMaterial, x: number, y: number, z: number) => {
    const m = new Mesh(own(geo), mat);
    m.position.set(x, y, z);
    m.frustumCulled = false;
    root.add(m);
    return m;
  };

  for (const side of [-1, 1]) {
    add(new CylinderGeometry(0.15, 0.19, PILLAR_H, 18), lacquer, side * PILLAR_X, PILLAR_H / 2, 0);
    // A dark stone foot, and a glowing line down the front of the pillar.
    add(new CylinderGeometry(0.26, 0.3, 0.22, 18), black, side * PILLAR_X, 0.11, 0);
    add(new BoxGeometry(0.022, PILLAR_H - 0.5, 0.022), trace, side * PILLAR_X, PILLAR_H / 2 + 0.1, 0.17);
  }
  // Lower tie beam and the two roof beams.
  add(new BoxGeometry(PILLAR_X * 2 + 0.3, 0.14, 0.2), lacquer, 0, PILLAR_H - 0.7, 0);
  add(new BoxGeometry(PILLAR_X * 2 + 1.5, 0.2, 0.4), black, 0, PILLAR_H + 0.08, 0);
  add(new BoxGeometry(PILLAR_X * 2 + 0.7, 0.13, 0.3), lacquer, 0, PILLAR_H - 0.12, 0);
  // Glowing lines along both beams.
  add(new BoxGeometry(PILLAR_X * 2 + 1.3, 0.02, 0.02), trace, 0, PILLAR_H + 0.1, 0.21);
  add(new BoxGeometry(PILLAR_X * 2 - 0.2, 0.02, 0.02), trace, 0, PILLAR_H - 0.7, 0.11);

  function update(_time: number, pos: number) {
    const w = propWeight(pos, CHAPTER);
    root.visible = w > 0.01;
    if (!root.visible) return;
    for (const m of mats) m.opacity = w;
    trace.emissiveIntensity = 2.2 * w;
  }

  return { root, update, dispose: disposeAll };
}
