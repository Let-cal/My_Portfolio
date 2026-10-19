"use client";

import {
  BufferAttribute,
  CustomBlending,
  InstancedBufferGeometry,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Points,
  ShaderMaterial,
  type Texture,
} from "three";
import type { Tier } from "../tier";
import { cloudIndices } from "./cloud";
import { SCATTER_SPREAD } from "./config";
import type { CreatureRig } from "./rig";

export type CloudQuality = {
  /** Keep one in this many body vertices (see `cloudIndices`). */
  stride: number;
  /** How many jittered copies of each kept vertex are drawn: the cloud is a thin fuzzy shell, not a bare lattice. */
  layers: number;
};

/** The `low` tier keeps half of the vertices (of an already lighter body) and the same number of layers. */
export function cloudQualityForTier(tier: Exclude<Tier, "off">): CloudQuality {
  return tier === "high" ? { stride: 1, layers: 3 } : { stride: 2, layers: 3 };
}

const VERTEX = /* glsl */ `
attribute vec3 aRand;
uniform float uScatter;
uniform float uMorph;
uniform float uTime;
uniform float uScan;
uniform float uDay;
uniform float uVis;
uniform float uViewH;
uniform float uSpread;
uniform sampler2D uMap;
varying vec3 vCol;
varying float vAlpha;
varying float vBeam;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  float layer = float(gl_InstanceID);
  // Layer 0 is the mesh's own vertices with their seeded random; the others are jittered copies with their own.
  vec3 rl = vec3(hash(aRand.x * 91.7 + layer * 13.1), hash(aRand.y * 57.3 + layer * 7.7), hash(aRand.z * 33.9 + layer * 3.3));
  vec3 rr = layer < 0.5 ? aRand : rl * 2.0 - 1.0;
  vec3 pos = position + (layer < 0.5 ? vec3(0.0) : (rl - 0.5) * 0.045);

  // The head leaves first and the tail last; coming back it is the other way round.
  float order = uv.x * 0.42 + (rr.z * 0.5 + 0.5) * 0.28;
  float s = clamp(uScatter * 1.7 - order, 0.0, 1.0);
  s = s * s * (3.0 - 2.0 * s);

  // Data motes rise off the water: spread sideways in every direction, but only ever upwards.
  vec3 dir = vec3(rr.x, abs(rr.y) * 0.75 + 0.18, rr.z);
  vec3 p = pos + dir * (s * uSpread);
  p += 0.05 * s * vec3(sin(uTime * 1.7 + rr.y * 12.0), sin(uTime * 2.3 + rr.z * 9.0), sin(uTime * 1.9 + rr.x * 11.0));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float beam = exp(-pow(uv.x - uScan, 2.0) / 0.0016);
  float present = smoothstep(0.0, 0.16, uScatter);

  // Koi pattern to dragon gold; a few points carry the circuit's orange.
  vec3 koi = texture2D(uMap, uv).rgb;
  vec3 gold = vec3(1.0, 0.66, 0.2);
  vec3 base = mix(koi * 1.15 + 0.06, gold, smoothstep(0.15, 0.85, uMorph));
  base = mix(base, vec3(1.0, 0.42, 0.1), step(0.7, rr.x * 0.5 + 0.5) * 0.65);
  vec3 night = base * (0.6 + 0.35 * rr.y);
  vec3 day = base * base * vec3(0.8, 0.62, 0.45);
  vCol = mix(night, day, uDay);
  vBeam = beam * present;
  vAlpha = present * (0.3 + 0.7 * uVis) * (0.75 + 0.25 * s);

  float world = (0.017 + 0.009 * rl.z) * (1.0 + 0.5 * s) + 0.024 * beam * present;
  gl_PointSize = max(1.5, world * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z);
}
`;

const FRAGMENT = /* glsl */ `
uniform float uDay;
varying vec3 vCol;
varying float vAlpha;
varying float vBeam;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  if (d > 1.0) discard;
  float soft = (1.0 - d) * (1.0 - d);
  float core = smoothstep(0.4, 0.0, d);
  vec3 rgb = vCol * (0.5 + 0.9 * core) + vec3(1.0, 0.93, 0.8) * vBeam * (0.7 + core);
  float a = vAlpha * soft;
  // Premultiplied, one blend for both ponds: at night the alpha is tiny so the points add their light to the dark
  // water; by day it is nearly opaque so they read as dark gold dots on the bright water.
  gl_FragColor = vec4(rgb * a, a * mix(0.08, 0.95, uDay));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export type PointCloud = {
  /** Add this to the scene (it lives at the origin: the body's vertices are already in world space). */
  points: Points;
  /** Writes this frame's uniforms from the rig. Call right after `rig.update`. */
  update(
    rig: CreatureRig,
    time: number,
    day: number,
    pixelHeight: number,
  ): void;
  dispose(): void;
};

/**
 * The koi's body as data: the very same position, uv and random buffers as the body mesh (so the cloud follows the
 * animated spine and starts exactly where the koi is), drawn as soft points, a few jittered layers of them. The
 * vertex shader scatters each point by its seeded random times the rig's `scatter` and colours it from the koi
 * pattern to dragon gold; a bright beam runs head to tail along the body. Hidden while `scatter` is 0, so a koi or a
 * dragon at rest costs nothing here.
 */
export function createPointCloud(
  rig: CreatureRig,
  tier: Exclude<Tier, "off">,
): PointCloud {
  const { stride, layers } = cloudQualityForTier(tier);
  const body = rig.bodyGeometry;
  const ring = body.userData.ring as { rings: number; sides: number };

  const geometry = new InstancedBufferGeometry();
  // Shared, not copied: one upload per frame serves the mesh and the cloud.
  geometry.setAttribute(
    "position",
    body.getAttribute("position") as BufferAttribute,
  );
  geometry.setAttribute("uv", body.getAttribute("uv") as BufferAttribute);
  geometry.setAttribute("aRand", body.getAttribute("aRand") as BufferAttribute);
  geometry.setIndex(
    new BufferAttribute(cloudIndices(ring.rings, ring.sides, stride), 1),
  );
  geometry.instanceCount = layers;

  const material = new ShaderMaterial({
    uniforms: {
      uScatter: { value: 0 },
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uScan: { value: -1 },
      uDay: { value: 0 },
      uVis: { value: 1 },
      uViewH: { value: 800 },
      uSpread: { value: SCATTER_SPREAD },
      uMap: { value: null as Texture | null },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.visible = false;
  points.name = "creature-cloud";

  const u = material.uniforms;
  return {
    points,
    update(r, time, day, pixelHeight) {
      const scatter = r.scatter;
      points.visible = scatter > 0;
      if (!points.visible) return;
      u.uScatter.value = scatter;
      u.uMorph.value = r.morph;
      u.uTime.value = time;
      // A beam sweeps the body from the snout to a little past the tail, then rests for a moment.
      u.uScan.value = ((time * 0.42) % 1.5) - 0.25;
      u.uDay.value = day;
      u.uVis.value = r.visibility;
      u.uViewH.value = pixelHeight;
      u.uMap.value = r.bodyMaterial.map;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/** Puts the cloud into the scene. */
export function PointCloudMorph({ cloud }: { cloud: PointCloud }) {
  return <primitive object={cloud.points} />;
}
