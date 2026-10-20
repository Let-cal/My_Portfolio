import {
  CylinderGeometry,
  Color,
  Group,
  InstancedMesh,
  LatheGeometry,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  AdditiveBlending,
  Vector2,
} from "three";
import { mulberry32 } from "../../creature/random";
import { WATER_Y } from "../constants";
import { propWeight } from "../math";
import { createOwner, type Prop } from "./types";

const CHAPTER = 4;
const PER_BANK = 6;
const COUNT = PER_BANK * 2;
const POLE_H = 1.75;
const ARM = 0.5;

/** A ribbed paper lantern: a rounded barrel, a little taller than wide. */
export function lanternGeometry(): LatheGeometry {
  const pts: Vector2[] = [];
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const y = (u - 0.5) * 0.44;
    // A barrel whose ends close in, with fine ribs.
    const barrel = Math.sin(Math.PI * (0.08 + 0.84 * u));
    const ribs = 1 + 0.045 * Math.sin(u * Math.PI * 2 * 7);
    pts.push(new Vector2(Math.max(0.02, 0.17 * barrel * ribs), y));
  }
  return new LatheGeometry(pts, 20);
}

/** The post: a flared stone foot, then a slender shaft. */
function poleGeometry(): CylinderGeometry {
  return new CylinderGeometry(0.035, 0.05, POLE_H, 8).translate(
    0,
    POLE_H / 2,
    0,
  );
}

const GLOW_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;
const GLOW_FRAGMENT = /* glsl */ `
uniform float uStrength;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.2) * uStrength;
  gl_FragColor = vec4(vec3(1.0, 0.5, 0.18) * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Chapter 4, the lantern bank: posts along both shores with paper lanterns that sway, glowing at night. */
export function createLanterns(): Prop {
  const { own, disposeAll } = createOwner();
  const root = new Group();
  root.name = "lanterns";
  const rand = mulberry32(4040);

  const spots = Array.from({ length: COUNT }, (_, i) => {
    const side = i < PER_BANK ? -1 : 1;
    const k = i % PER_BANK;
    return {
      side,
      x: side * (3.05 + (rand() - 0.5) * 0.3),
      z: -5.2 + k * 1.15 + (rand() - 0.5) * 0.3,
      seed: rand(),
    };
  });

  const woodMat = own(
    new MeshStandardMaterial({
      color: 0x241810,
      roughness: 0.75,
      metalness: 0.1,
      transparent: true,
    }),
  );
  const posts = new InstancedMesh(own(poleGeometry()), woodMat, COUNT);
  const arms = new InstancedMesh(
    own(
      new CylinderGeometry(0.018, 0.018, ARM, 6)
        .rotateZ(Math.PI / 2)
        .translate(ARM / 2, 0, 0),
    ),
    woodMat,
    COUNT,
  );
  const caps = new InstancedMesh(
    own(new CylinderGeometry(0.085, 0.07, 0.035, 14)),
    woodMat,
    COUNT * 2,
  );
  const paperMat = own(
    new MeshStandardMaterial({
      color: 0x7a3512,
      emissive: new Color(0xff8a2b),
      emissiveIntensity: 1.8,
      roughness: 0.6,
      transparent: true,
    }),
  );
  const lamps = new InstancedMesh(own(lanternGeometry()), paperMat, COUNT);

  const glowMat = own(
    new ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      uniforms: { uStrength: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  const glows = new InstancedMesh(
    own(new PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2)),
    glowMat,
    COUNT,
  );
  glows.renderOrder = -8;

  for (const m of [posts, arms, caps, lamps, glows]) m.frustumCulled = false;
  root.add(posts, arms, caps, lamps, glows);

  const dummy = new Object3D();
  // Posts, arms and glow spots stand still: written once.
  for (let i = 0; i < COUNT; i++) {
    const s = spots[i];
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.position.set(s.x, WATER_Y, s.z);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
    // The arm points towards the middle of the pond.
    dummy.rotation.set(0, s.side < 0 ? 0 : Math.PI, 0);
    dummy.position.set(s.x, WATER_Y + POLE_H, s.z);
    dummy.updateMatrix();
    arms.setMatrixAt(i, dummy.matrix);
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(s.x - s.side * ARM, WATER_Y + 0.01, s.z);
    dummy.updateMatrix();
    glows.setMatrixAt(i, dummy.matrix);
  }
  posts.instanceMatrix.needsUpdate = true;
  arms.instanceMatrix.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;

  function update(time: number, pos: number, day: number) {
    const w = propWeight(pos, CHAPTER);
    root.visible = w > 0.01;
    if (!root.visible) return;
    woodMat.opacity = w;
    paperMat.opacity = w;
    // Lit at night (the glow that blooms), mere paper by day.
    paperMat.emissiveIntensity = (0.25 + 1.55 * (1 - day)) * w;
    glowMat.uniforms.uStrength.value = 0.5 * (1 - day) * w;
    for (let i = 0; i < COUNT; i++) {
      const s = spots[i];
      const sway = Math.sin(time * 0.9 + s.seed * 12) * 0.06;
      const hangY = WATER_Y + POLE_H - 0.3;
      dummy.rotation.set(0, 0, sway * 0.6);
      dummy.scale.setScalar(1);
      dummy.position.set(s.x - s.side * ARM, hangY, s.z);
      dummy.updateMatrix();
      lamps.setMatrixAt(i, dummy.matrix);
      dummy.position.y = hangY + 0.225;
      dummy.updateMatrix();
      caps.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.y = hangY - 0.225;
      dummy.updateMatrix();
      caps.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    lamps.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
  }

  return {
    root,
    update,
    dispose() {
      for (const m of [posts, arms, caps, lamps, glows]) m.dispose();
      disposeAll();
    },
  };
}
