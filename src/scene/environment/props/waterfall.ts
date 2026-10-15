import { BoxGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial } from "three";
import { WATER_Y } from "../constants";
import { propWeight } from "../math";
import { createOwner, type Prop } from "./types";
import { createWaterfallLandscape } from "./waterfall-landscape";

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
  float fallWidth = mix(2.2, 0.85, smoothstep(0.0, 1.0, y));
  float mainFall = 1.0 - smoothstep(fallWidth, fallWidth + 0.3, abs(x + wob));
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
  float splash = (1.0 - smoothstep(0.0, 0.3, y)) * (1.0 - smoothstep(1.2, 3.8, abs(x))) * vnoise(vec2(x * 2.0, y * 6.0 - uTime * 0.6)) * 0.55;
  col = mix(col, foamC, clamp(foam + splash, 0.0, 1.0));
  float lip = 1.0 - smoothstep(0.97, 1.0, y);
  float a = mask * (0.22 + 0.55 * streak) * lip + splash * 0.5;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const BASIN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uDay;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = (vUv - 0.5) * vec2(2.0, 1.0);
  float d = length(p);
  float edge = 1.0 - smoothstep(0.2, 0.95, d);
  float rings = pow(0.5 + 0.5 * sin(d * 48.0 - uTime * 5.0 + vnoise(p * 8.0)), 5.0);
  float foam = vnoise(p * 24.0 + vec2(uTime * 0.7, -uTime)) * (1.0 - smoothstep(0.05, 0.4, d));
  vec3 col = mix(vec3(0.18, 0.4, 0.43), vec3(0.83, 0.94, 0.91), uDay);
  gl_FragColor = vec4(col, edge * (rings * 0.22 + foam * 0.5) * uOpacity);
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

  const cliffMat = own(new MeshStandardMaterial({ color: 0xc0c3b7, vertexColors: true, roughness: 0.92, transparent: true }));
  const fallMat = own(material(FALL_FRAGMENT));
  const cliffGeometry = own(new BoxGeometry(28, 9, 2.6, 64, 24, 2));
  const cp = cliffGeometry.getAttribute("position");
  const cliffColors = new Float32Array(cp.count * 3), color = new Color();
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), depth = cp.getZ(i);
    const grain = Math.sin(x * 3.2 + y * 0.4) * Math.cos(y * 4.7) * 0.15;
    if (y > 4.4) cp.setY(i, y + Math.sin(x * 1.3) * 0.3 + Math.cos(x * 2.9) * 0.18);
    if (depth > 0) cp.setZ(i, depth + (4.5 - y) * 0.12 + grain - Math.max(0, 1 - Math.abs(x) / 2) * 0.5);
    color.setRGB(0.7 + grain, 0.76 + grain, 0.65 + grain);
    color.toArray(cliffColors, i * 3);
  }
  cliffGeometry.setAttribute("color", new Float32BufferAttribute(cliffColors, 3)); cliffGeometry.computeVertexNormals();
  const cliff = new Mesh(cliffGeometry, cliffMat);
  cliff.name = "waterfall-cliff";
  cliff.position.set(0, WATER_Y + 4.2, FALL_Z - 1.4);
  cliff.renderOrder = -6;
  const basinMat = own(material(BASIN_FRAGMENT));
  const mats = [fallMat, basinMat];
  const fallGeometry = own(new PlaneGeometry(FALL_W, FALL_H, 48, 64));
  const fp = fallGeometry.getAttribute("position");
  const smooth = (a: number, b: number, value: number) => { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < fp.count; i++) {
    const y = (fp.getY(i) + FALL_H / 2) / FALL_H;
    fp.setZ(i, 0.6 + 0.75 * (1 - smooth(0.6, 0.7, y)) + (1 - smooth(0.25, 0.35, y)));
  }
  fallGeometry.computeVertexNormals();
  const fall = new Mesh(fallGeometry, fallMat);
  fall.name = "waterfall-cascade";
  fall.position.set(0, WATER_Y + FALL_H / 2, FALL_Z);
  fall.renderOrder = -5;
  for (const m of [cliff, fall]) m.frustumCulled = false;
  const basin = new Mesh(own(new PlaneGeometry(11, 7)), basinMat);
  basin.name = "waterfall-basin";
  basin.rotation.x = -Math.PI / 2;
  basin.position.set(0, WATER_Y + 0.035, FALL_Z + 2.4);
  basin.renderOrder = -4;
  const landscape = createWaterfallLandscape(own, FALL_Z, cliffMat);
  root.add(cliff, fall, basin, landscape.root);

  function update(time: number, pos: number, day: number) {
    const w = propWeight(pos, CHAPTER);
    root.visible = w > 0.01;
    if (!root.visible) return;
    landscape.update(w, day, time, pos);
    cliffMat.opacity = w;
    for (let i = 0; i < mats.length; i++) {
      const u = mats[i].uniforms;
      u.uTime.value = time;
      u.uOpacity.value = w;
      u.uDay.value = day;
    }
  }

  return { root, update, dispose: disposeAll };
}
