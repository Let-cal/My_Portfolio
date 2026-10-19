import {
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type BufferGeometry,
} from "three";
import { mulberry32 } from "../../creature/random";
import { WATER_Y } from "../constants";
import { createOwner } from "./types";

/** Three simplified CC0 scanned rocks, repeated as actual geometry; loaded only near Skills. */
export function createRockAssets(
  own: ReturnType<typeof createOwner>["own"],
  z: number,
  cliff: MeshStandardMaterial,
) {
  const root = new Group();
  root.name = "waterfall-scanned-rocks";
  let requested = false,
    ready = false,
    disposed = false;
  const materials: MeshStandardMaterial[] = [];
  const white = new Color(0xffffff),
    night = new Color(0x617c80);
  own({
    dispose() {
      disposed = true;
    },
  });
  const accept = (scene: Object3D) => {
    const geometries = new Set<BufferGeometry>();
    const mats = new Set<MeshStandardMaterial>();
    const textures = new Set<Texture>();
    const sources: Mesh[] = [];
    scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      sources.push(node);
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material]) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        mats.add(material);
        for (const value of Object.values(material))
          if (value instanceof Texture) textures.add(value);
      }
    });
    for (const resource of [...geometries, ...mats, ...textures]) {
      if (disposed) resource.dispose();
      else own(resource);
    }
    if (disposed) return;
    const random = mulberry32(1827),
      dummy = new Object3D();
    for (const source of sources) {
      const geometry = source.geometry;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const span = Math.max(
        box.max.x - box.min.x,
        box.max.y - box.min.y,
        box.max.z - box.min.z,
      );
      geometry.center();
      geometry.scale(2 / span, 2 / span, 2 / span);
      const mat = source.material as MeshStandardMaterial;
      mat.transparent = true;
      if (!materials.includes(mat)) materials.push(mat);
      const batch = own(new InstancedMesh(geometry, mat, 8));
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1,
          tier = Math.floor(i / 2);
        dummy.position.set(
          side * (2.3 + random() * 3.5),
          WATER_Y + 0.4 + tier * 1.4 + (random() - 0.5) * 0.45,
          z + 1.7 - tier * 0.35 + random() * 0.35,
        );
        dummy.scale.set(
          1.2 + random() * 1.1,
          0.9 + random(),
          0.7 + random() * 0.7,
        );
        dummy.rotation.set(
          (random() - 0.5) * 0.3,
          random() * Math.PI * 2,
          (random() - 0.5) * 0.3,
        );
        dummy.updateMatrix();
        batch.setMatrixAt(i, dummy.matrix);
      }
      batch.computeBoundingSphere();
      root.add(batch);
    }
    ready = sources.length > 0;
  };
  return {
    root,
    get ready() {
      return ready;
    },
    update(position: number, weight: number, day: number) {
      if (
        !requested &&
        position > 2.05 &&
        position < 4.2 &&
        typeof document !== "undefined"
      ) {
        requested = true;
        for (const [filename, kind] of [
          ["cliff-albedo.jpg", "map"],
          ["cliff-normal.jpg", "normalMap"],
        ] as const) {
          const texture = own(
            new TextureLoader().load(
              `/scene/waterfall/rocks/${filename}`,
              (loaded) => {
                if (disposed) return;
                loaded.wrapS = loaded.wrapT = RepeatWrapping;
                loaded.repeat.set(3, 1.7);
                if (kind === "map") loaded.colorSpace = SRGBColorSpace;
                cliff[kind] = loaded;
                cliff.normalScale.set(0.6, 0.6);
                cliff.needsUpdate = true;
              },
              undefined,
              () => {},
            ),
          );
          if (kind === "map") texture.colorSpace = SRGBColorSpace;
        }
        void import("three/examples/jsm/loaders/GLTFLoader.js")
          .then(({ GLTFLoader }) => {
            if (disposed) return;
            new GLTFLoader().load(
              "/scene/waterfall/rocks/rocks.gltf",
              (gltf) => accept(gltf.scene),
              undefined,
              () => {},
            );
          })
          .catch(() => {});
      }
      root.visible = ready && weight > 0.01;
      for (const mat of materials) {
        mat.opacity = weight;
        mat.color.copy(night).lerp(white, day);
      }
    },
  };
}
