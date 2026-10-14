import { Group, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { WATER_Y } from "../constants";
import { propWeight } from "../math";
import { createOwner, type Prop } from "./types";

const CHAPTER = 3;
/** The fall stands this far behind the koi's pond, so the koi seems to swim up to it. */
export const FALL_Z = -5.2;
const FALL_W = 15;
const FALL_H = 9;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
`;

/* Falling water: stretched noise that scrolls down, three streams of different width, foam where it lands. */
const FALL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uDay;
varying vec2 vUv;
${NOISE}
void main() {
  float x = (vUv.x - 0.5) * ${FALL_W.toFixed(1)};
  float y = vUv.y;
  float wob = (vnoise(vec2(y * 4.0, 3.0)) - 0.5) * 0.7;
  float mainFall = 1.0 - smoothstep(1.5, 1.9, abs(x + wob));
  float sideA = 1.0 - smoothstep(0.35, 0.6, abs(x - 4.6 + wob * 0.6));
  float sideB = 1.0 - smoothstep(0.25, 0.5, abs(x + 5.4 + wob * 0.6));
  float mask = max(mainFall, max(sideA * 0.8, sideB * 0.7));
  float n1 = vnoise(vec2(x * 5.0, y * 2.6 + uTime * 1.5));
  float n2 = vnoise(vec2(x * 13.0, y * 5.0 + uTime * 2.8));
  float streak = smoothstep(0.42, 0.85, n1 * 0.6 + n2 * 0.4);
  vec3 deep = mix(vec3(0.03, 0.08, 0.11), vec3(0.35, 0.62, 0.72), uDay);
  vec3 foamC = mix(vec3(0.34, 0.55, 0.64), vec3(1.0), uDay);
  vec3 col = mix(deep, foamC, streak);
  float foam = (1.0 - smoothstep(0.0, 0.14, y)) * (0.55 + 0.45 * vnoise(vec2(x * 5.0 + uTime * 0.9, uTime * 2.0)));
  float splash = (1.0 - smoothstep(0.0, 0.3, y)) * smoothstep(3.8, 1.2, abs(x)) * vnoise(vec2(x * 2.0, y * 6.0 - uTime * 0.6)) * 0.55;
  col = mix(col, foamC, clamp(foam + splash, 0.0, 1.0));
  float lip = smoothstep(1.0, 0.82, y);
  float a = mask * (0.22 + 0.55 * streak) * lip + splash * 0.5;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/* The rock wall behind the fall: dark strata with a cool rim, pale grey stone by day. */
const CLIFF_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uDay;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vec2(vUv.x * 14.0, vUv.y * 9.0);
  float strata = vnoise(vec2(p.x * 0.5, p.y * 5.0)) * 0.6 + vnoise(p * 2.2) * 0.4;
  float crack = smoothstep(0.62, 0.7, vnoise(p * 3.1 + 7.0));
  vec3 night = mix(vec3(0.012, 0.018, 0.024), vec3(0.05, 0.07, 0.085), strata) - crack * 0.01;
  vec3 day = mix(vec3(0.42, 0.48, 0.5), vec3(0.62, 0.68, 0.68), strata) - crack * 0.08;
  vec3 col = mix(night, day, uDay);
  float low = 1.0 - smoothstep(0.0, 0.25, vUv.y);
  col += vec3(0.03, 0.09, 0.11) * low * (1.0 - uDay);
  gl_FragColor = vec4(col, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function material(fragment: string) {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uDay: { value: 0 } },
  });
}

/** Chapter 3, the waterfall: a rock wall at the far end of the pond with a shader-drawn fall pouring down it. */
export function createWaterfall(): Prop {
  const { own, disposeAll } = createOwner();
  const root = new Group();
  root.name = "waterfall";

  const cliffMat = own(material(CLIFF_FRAGMENT));
  const fallMat = own(material(FALL_FRAGMENT));
  const cliff = new Mesh(own(new PlaneGeometry(34, 14)), cliffMat);
  cliff.position.set(0, WATER_Y + 6.2, FALL_Z - 0.4);
  cliff.renderOrder = -6;
  const mats = [cliffMat, fallMat];
  const fall = new Mesh(own(new PlaneGeometry(FALL_W, FALL_H)), fallMat);
  fall.position.set(0, WATER_Y + FALL_H / 2, FALL_Z);
  fall.renderOrder = -5;
  for (const m of [cliff, fall]) m.frustumCulled = false;
  root.add(cliff, fall);

  function update(time: number, pos: number, day: number) {
    const w = propWeight(pos, CHAPTER);
    root.visible = w > 0.01;
    if (!root.visible) return;
    for (let i = 0; i < mats.length; i++) {
      const u = mats[i].uniforms;
      u.uTime.value = time;
      u.uOpacity.value = w;
      u.uDay.value = day;
    }
  }

  return { root, update, dispose: disposeAll };
}
