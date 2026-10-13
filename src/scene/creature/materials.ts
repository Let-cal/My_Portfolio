import { Color, DoubleSide, MeshStandardMaterial, type Texture } from "three";

/** Uniforms shared with the patched shaders. Update `.value` directly each frame. */
export type CrossfadeUniforms = {
  /** The previous pattern, shown under `map` while `uFade` runs 0 to 1 after a role change. */
  uPrevMap: { value: Texture | null };
  uFade: { value: number };
};

export type BodyUniforms = CrossfadeUniforms & {
  uDragonMap: { value: Texture | null };
  uMorph: { value: number };
  uTime: { value: number };
};

const CROSSFADE_MAP = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = mix( texture2D( uPrevMap, vMapUv ), texture2D( map, vMapUv ), uFade );
  #ifdef CREATURE_DRAGON
    sampledDiffuseColor = mix( sampledDiffuseColor, texture2D( uDragonMap, vMapUv ), smoothstep( 0.15, 0.85, uMorph ) );
    // Traces are etched into the skin: darker grooves that the emissive light then fills.
    sampledDiffuseColor.rgb *= 1.0 - 0.85 * texture2D( emissiveMap, vMapUv ).r;
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif
`;

/*
 * Circuit emissive: R = trace, G/R = phase, B/R = pad (see makeCircuitTexture). Every trace glows faintly; a bright
 * pulse with a fading tail runs along it from head to tail, each trace at its own phase. Pads breathe.
 */
const CIRCUIT_EMISSIVE = /* glsl */ `
#ifdef USE_EMISSIVEMAP
  vec4 circ = texture2D( emissiveMap, vEmissiveMapUv );
  float trace = circ.r;
  float inv = 1.0 / max( circ.r, 0.004 );
  float phase = circ.g * inv;
  float pad = clamp( circ.b * inv, 0.0, 1.0 );
  float p = fract( vEmissiveMapUv.x * 1.4 - uTime * 0.28 + phase );
  float comet = smoothstep( 0.55, 0.97, p ) * ( 1.0 - smoothstep( 0.97, 1.0, p ) );
  float glow = 1.3 + 4.0 * comet;
  glow = mix( glow, 0.9 + 0.5 * sin( uTime * 3.0 + phase * 6.2832 ), pad );
  totalEmissiveRadiance *= trace * glow;
#endif
`;

function patch(material: MeshStandardMaterial, uniforms: Record<string, { value: unknown }>, decl: string, dragon: boolean) {
  if (dragon) material.defines = { ...material.defines, CREATURE_DRAGON: "" };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${decl}`)
      .replace("#include <map_fragment>", CROSSFADE_MAP)
      .replace("#include <emissivemap_fragment>", dragon ? CIRCUIT_EMISSIVE : "#include <emissivemap_fragment>");
  };
  material.customProgramCacheKey = () => (dragon ? "creature-body" : "creature-fin");
}

/**
 * The Cyber Koi skin: PBR ivory with the variety's pattern, a glowing orange circuit (emissive map), scale relief
 * (bump map) and the dragon hide blended in with `uMorph`.
 */
export function createBodyMaterial(maps: { koi: Texture; dragon: Texture; circuit: Texture; bump: Texture }) {
  const uniforms: BodyUniforms = {
    uPrevMap: { value: maps.koi },
    uFade: { value: 1 },
    uDragonMap: { value: maps.dragon },
    uMorph: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new MeshStandardMaterial({
    map: maps.koi,
    emissiveMap: maps.circuit,
    emissive: new Color(0xff7a2a),
    emissiveIntensity: 0.8,
    bumpMap: maps.bump,
    bumpScale: 2,
    roughness: 0.34,
    metalness: 0.1,
    envMapIntensity: 0.5,
  });
  patch(
    material,
    uniforms,
    "uniform sampler2D uPrevMap; uniform float uFade; uniform sampler2D uDragonMap; uniform float uMorph; uniform float uTime;",
    true,
  );
  return { material, uniforms };
}

/** Translucent fin membrane, cross-fading between varieties like the body. */
export function createFinMaterial(map: Texture, glow: Texture) {
  const uniforms: CrossfadeUniforms = { uPrevMap: { value: map }, uFade: { value: 1 } };
  const material = new MeshStandardMaterial({
    map,
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    roughness: 0.5,
    metalness: 0,
    envMapIntensity: 0.4,
    emissiveMap: glow,
    emissive: new Color(0xff7a2a),
    emissiveIntensity: 1.8,
  });
  // One pass: three's default back-then-front pass for transparent double-sided materials doubles the draw calls
  // and flags the material for a program check twice a frame. The fins are thin, so the order hardly shows.
  material.forceSinglePass = true;
  patch(material, uniforms, "uniform sampler2D uPrevMap; uniform float uFade;", false);
  return { material, uniforms };
}

/** Polished gold for the dragon's horns, claws and the plates of its head. */
export function createAccentMaterial() {
  return new MeshStandardMaterial({
    color: 0xf5c46b,
    metalness: 0.95,
    roughness: 0.22,
    emissive: new Color(0x5a1d06),
    emissiveIntensity: 0.6,
  });
}

/** Glowing orange for the dragon's spines, mane and tail tuft: the circuit's light, grown into the body. */
export function createGlowMaterial() {
  return new MeshStandardMaterial({
    color: 0x3a1606,
    metalness: 0.4,
    roughness: 0.35,
    emissive: new Color(0xff7a2a),
    emissiveIntensity: 1.4,
  });
}

/** Glossy black eye; the dragon's eyes glow orange (emissiveIntensity follows morph). */
export function createEyeMaterial() {
  return new MeshStandardMaterial({
    color: 0x050505,
    metalness: 0.5,
    roughness: 0.08,
    emissive: new Color(0xff6a00),
    emissiveIntensity: 0,
  });
}
