"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, DoubleSide, ShaderMaterial, Vector3 } from "three";
import { BODY_SAMPLES, creatureLive } from "../creature/live";
import { DAY_BG, DAY_WATER, NIGHT_BG, NIGHT_WATER, WATER_Y } from "./constants";
import { GARDEN_CELESTIAL, GARDEN_LAMPS, gardenWeight } from "./garden";
import { GARDEN_NIGHT_GLSL as night } from "./garden-palette";
import { sceneLive } from "./live";
import { MAX_RIPPLES } from "./ripples";

const VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/*
 * Night: the cyber pond outside the garden, moonlit obsidian water inside it; an orange sheen where the creature is, and a
 * hot spot from the light that follows its head. Day: clear shallow water with moving caustics and a pale sky in
 * the reflections. One shader, `uDay` crossfades the two, so the theme switch needs no second pond.
 * The creature floats a little above the surface, so its glow and shadow are drawn onto the water from six points
 * along its body (`uBody`).
 */
const FRAGMENT = /* glsl */ `
#define RIPPLES ${MAX_RIPPLES}
#define BODY ${BODY_SAMPLES}
uniform float uTime;
uniform float uDay;
uniform float uGarden;
uniform float uFlow;
uniform float uVisible;
uniform float uMorph;
uniform vec3 uRipples[RIPPLES];
uniform vec3 uBody[BODY];
uniform vec3 uHead;
uniform vec3 uNightWater;
uniform vec3 uDayWater;
uniform vec3 uNightFog;
uniform vec3 uDayFog;
varying vec3 vWorld;

/* Soft caustic web: sum of two drifting, interfering sine lattices. */
float caustic(vec2 p, float t) {
  vec2 q = p;
  float c = 0.0;
  for (int n = 0; n < 3; n++) {
    float tt = t * (1.0 - 0.6 / float(n + 1));
    q = p + vec2(cos(tt - q.x) + sin(tt + q.y), sin(tt - q.y) + cos(tt + q.x)) * 0.55;
    c += 1.0 / (0.4 + 3.2 * length(vec2(sin(q.x + tt), cos(q.y - tt))));
  }
  c /= 3.0;
  return pow(clamp(c * 0.55, 0.0, 1.0), 3.0);
}

void main() {
  vec2 xz = vWorld.xz;
  vec3 toCam = cameraPosition - vWorld;
  float camDist = length(toCam);
  vec3 V = toCam / camDist;

  // --- surface slope: ripples ring outwards from where they were made, plus a faint swell ---
  vec2 slope = vec2(0.0);
  float rippleLight = 0.0;
  for (int i = 0; i < RIPPLES; i++) {
    vec3 r = uRipples[i];
    float age = uTime - r.z;
    if (age < 0.0 || age > 4.0) continue;
    vec2 d = xz - r.xy;
    float dist = length(d) + 1e-4;
    float x = dist - age * 0.85;
    float env = exp(-age * 0.9) * smoothstep(0.0, 0.12, age);
    float win = exp(-x * x * 14.0);
    float k = 16.0;
    float h = sin(x * k) * win;
    float dh = (cos(x * k) * k * win - sin(x * k) * 28.0 * x * win) * env * 0.012;
    slope += dh * d / dist;
    rippleLight += h * env;
  }
  vec2 sw = xz * vec2(1.3, 1.1) + vec2(uTime * 0.22 - uFlow * 2.0, uTime * 0.17);
  slope += vec2(cos(sw.x * 1.7 + sw.y), sin(sw.y * 2.1 - sw.x)) * 0.004;
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));

  // --- reflection: a dark sky at night, a pale one by day; more mirror-like at grazing angles ---
  float cosV = max(dot(N, V), 0.0);
  float fresnel = 0.03 + 0.97 * pow(1.0 - cosV, 5.0);
  vec3 R = reflect(-V, N);
  float up = clamp(R.y, 0.0, 1.0);
  vec3 skyNight = mix(vec3(0.020, 0.030, 0.040), vec3(0.004, 0.007, 0.012), up);
  vec3 skyDay = mix(vec3(0.80, 0.90, 0.95), vec3(0.42, 0.66, 0.82), up);
  vec3 sky = mix(skyNight, skyDay, uDay);
  vec3 gardenSky = mix(mix(${night.horizon}, ${night.sky}, up),
                       mix(vec3(0.94, 0.78, 0.57), vec3(0.36, 0.63, 0.76), up), uDay);
  sky = mix(sky, gardenSky, uGarden);
  vec3 base = mix(uNightWater, uDayWater, uDay);
  base = mix(base, mix(${night.water}, vec3(0.20, 0.43, 0.42), uDay), uGarden);
  vec3 color = mix(base, sky, min(fresnel * (1.0 + 2.0 * uDay), 1.0));

  // --- day: sunlight through the water ---
  float cs = caustic(xz * 0.9 + slope * 2.0, uTime * 0.5 + uFlow);
  color += vec3(0.55, 0.85, 0.9) * cs * 0.30 * uDay;
  color += vec3(0.5, 0.8, 0.85) * clamp(rippleLight, 0.0, 1.0) * 0.12 * uDay;

  // Sunlit haze: by day the shallows are pale and airy rather than deep teal.
  color = mix(color, vec3(0.93, 0.98, 1.0), 0.15 * uDay);

  // Same world grid throughout the story. In the garden it reads as a submerged pattern,
  // with approximate depth/parallax, wave distortion and attenuation under grazing reflections.
  vec2 gridXZ = xz - V.xz / max(V.y, 0.2) * 0.18 * uGarden;
  vec2 g = (gridXZ + slope * mix(0.5, 1.5, uGarden) + vec2(uFlow * 1.3, 0.0)) / 0.5;
  vec2 gw = fwidth(g) * 1.2;
  vec2 cell = abs(fract(g - 0.5) - 0.5) / max(gw, vec2(1e-4));
  float line = 1.0 - min(min(cell.x, cell.y), 1.0);
  vec2 gm = g / 4.0;
  vec2 cellM = abs(fract(gm - 0.5) - 0.5) / max(fwidth(gm) * 1.2, vec2(1e-4));
  float lineM = 1.0 - min(min(cellM.x, cellM.y), 1.0);
  float gridFade = 1.0 / (1.0 + 0.045 * camDist * camDist * 0.1);
  float grid = (line * 0.34 + lineM * 0.42) * gridFade;

  // --- the creature's light and shadow on the water ---
  float headD = distance(xz, uHead.xz);
  float sheen = exp(-headD * headD * 0.5);
  float body = 0.0;
  for (int i = 0; i < BODY; i++) {
    vec3 b = uBody[i];
    float d = distance(xz, b.xz);
    body += exp(-d * d * 4.5);
  }
  float lit = uVisible;
  vec3 warm = vec3(1.0, 0.43, 0.14);
  float gridBoost = 1.0 + 3.2 * sheen * lit;
  vec2 basinOffset = xz - vec2(0.0, -2.8);
  float underwaterGrid = 0.48 * (1.0 - fresnel) * (1.0 - exp(-dot(basinOffset, basinOffset) * 0.16) * 0.8);
  vec3 gridColor = mix(vec3(0.23, 0.13, 0.063), ${night.grid}, uGarden);
  color += gridColor * grid * gridBoost * 0.55 * (1.0 - uDay * 0.9)
    * mix(1.0, underwaterGrid * (1.0 - uDay), uGarden);
  color += warm * sheen * 0.16 * lit * (1.0 - uDay * 0.7);
  color += warm * clamp(body, 0.0, 1.0) * 0.05 * lit * (1.0 - uDay * 0.8);
  // Under the body the water is a little darker: the creature hovers above it.
  float shade = clamp(body, 0.0, 1.0) * (0.10 + 0.05 * uMorph);
  color *= 1.0 - shade * (0.5 + 0.5 * uDay);

  // The light that follows the head, on the ripples.
  vec3 lightPos = vec3(uHead.x, uHead.y + 1.5, uHead.z);
  vec3 L = lightPos - vWorld;
  float ld = length(L);
  L /= ld;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 70.0) / (1.0 + ld * ld * 0.35);
  color += mix(vec3(1.0, 0.62, 0.32), vec3(1.0, 0.95, 0.85), uDay) * spec * 0.9 * lit * (1.0 - uDay * 0.5);

  // Analytical glints from the physical celestial body and the three shore lanterns.
  // This approximates rough reflection; it never renders the entire scene a second time.
  vec3 celestial = vec3(${GARDEN_CELESTIAL.map((n) => n.toFixed(1)).join(", ")});
  vec3 celestialRay = normalize(celestial - vWorld);
  float reflection = pow(max(dot(R, celestialRay), 0.0), 220.0);
  float broken = 0.55 + 0.45 * sin(xz.y * 30.0 + uTime * 1.4 + slope.x * 80.0);
  color += mix(vec3(0.42, 0.63, 0.8), vec3(0.95, 0.64, 0.26), uDay) * mix(0.25, 1.0, uDay) * reflection * broken * uGarden;
  ${GARDEN_LAMPS.map(([x, z]) => `{
    vec3 lamp = vec3(${x.toFixed(1)}, ${(WATER_Y + 1.59).toFixed(2)}, ${z.toFixed(1)});
    float distanceToLamp = length(lamp - vWorld);
    float glint = pow(max(dot(R, normalize(lamp - vWorld)), 0.0), 180.0);
    float pool = exp(-dot(xz - lamp.xz, xz - lamp.xz) * 0.8) * 0.012;
    color += vec3(1.0, 0.46, 0.12) * (pool + glint * 0.55 / (1.0 + distanceToLamp * 0.2)) * uGarden * (1.0 - uDay);
  }`).join("\n")}

  // --- the far water melts into the air ---
  vec3 fogColor = mix(uNightFog, uDayFog, uDay);
  fogColor = mix(fogColor, mix(${night.horizon}, vec3(0.94, 0.78, 0.57), uDay), uGarden);
  float fogAmount = smoothstep(mix(14.0, 22.0, uGarden), mix(44.0, 60.0, uGarden), camDist);
  color = mix(color, fogColor, fogAmount);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Writes this frame's values into the water's uniforms (a plain function: the material is not a React value). */
function updateWater(material: ShaderMaterial, time: number) {
  const u = material.uniforms;
  u.uTime.value = time;
  u.uDay.value = sceneLive.day;
  u.uGarden.value = gardenWeight(sceneLive.pos);
  u.uFlow.value = sceneLive.flow;
  u.uVisible.value = creatureLive.visibility;
  u.uMorph.value = creatureLive.morph;
  (u.uHead.value as Vector3).set(creatureLive.head.x, creatureLive.head.y, creatureLive.head.z);
  (u.uBody.value as Float32Array).set(creatureLive.body);
}

/**
 * The pond. A single large plane with the shader above, lit by nothing but its own uniforms (so it costs the same
 * whatever lights the scene has). Reads the ripples, the creature's body and the day/night blend from the stage.
 */
export function Water() {
  const material = useMemo(() => {
    const body = new Float32Array(BODY_SAMPLES * 3);
    return new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uDay: { value: 0 },
        uGarden: { value: 0 },
        uFlow: { value: 0 },
        uVisible: { value: 1 },
        uMorph: { value: 0 },
        uRipples: { value: sceneLive.ripples.data },
        uBody: { value: body },
        uHead: { value: new Vector3() },
        uNightWater: { value: new Color(NIGHT_WATER) },
        uDayWater: { value: new Color(DAY_WATER) },
        uNightFog: { value: new Color(NIGHT_BG) },
        uDayFog: { value: new Color(DAY_BG) },
      },
    });
  }, []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => updateWater(material, clock.elapsedTime));

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, WATER_Y, 0]} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[90, 90, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
