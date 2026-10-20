import {
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from "three";
import { WATER_Y } from "../constants";
import { createOwner } from "./types";
import { createRockAssets } from "./rock-assets";
import { createMapleGrove } from "./maple-grove";

/** Real scanned stone instances and individually modeled maple branches/leaves, in the shared scene. */
export function createWaterfallLandscape(
  own: ReturnType<typeof createOwner>["own"],
  z: number,
  cliff: MeshStandardMaterial,
) {
  const root = new Group();
  const stone = own(
    new MeshStandardMaterial({
      color: 0x52635a,
      roughness: 0.94,
      transparent: true,
    }),
  );
  const rocks = own(
    new InstancedMesh(own(new IcosahedronGeometry(1, 1)), stone, 12),
  );
  rocks.name = "waterfall-rocks";
  const dummy = new Object3D();
  for (let i = 0; i < rocks.count; i++) {
    const side = i % 2 ? 1 : -1,
      tier = Math.floor(i / 4);
    dummy.position.set(
      side * (2.8 + (i % 4) * 0.8),
      WATER_Y + 0.5 + tier * 1.7,
      z + 1.8 - tier * 0.35,
    );
    dummy.rotation.set(0.1, i * 0.7, 0.1);
    dummy.scale.set(1.4, 0.65, 0.8);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.computeBoundingSphere();
  const scanned = createRockAssets(own, z, cliff),
    maples = createMapleGrove(own, z);
  root.add(rocks, scanned.root, maples.root);
  const night = new Color(0x233433),
    day = new Color(0x52635a);
  return {
    root,
    update(weight: number, sunlight: number, time: number, position: number) {
      scanned.update(position, weight, sunlight);
      rocks.visible = !scanned.ready;
      stone.opacity = weight;
      stone.color.copy(night).lerp(day, sunlight);
      maples.update(weight, sunlight, time);
    },
  };
}
