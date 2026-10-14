import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Plane,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
  type Camera,
  type Material,
  type Texture,
} from "three";
import type { KoiVariety } from "@/content/schema";
import { DRAGON_CHAPTER, scatterAt, transformState } from "../chapters";
import { creatureVisibility, findOpenSpot } from "../environment/legibility";
import { dampValue, smoothstep } from "../environment/math";
import { nearestFood } from "../interactions/feed";
import type { SceneState } from "../store";
import { SCATTER_SPREAD, varietyForRole, VARIETY_SURFACE, type CreatureQuality } from "./config";
import {
  fanGeometry,
  flexFan,
  hornGeometry,
  legGeometry,
  pectoralOutline,
  ribbonGeometry,
  tailOutline,
  type FanGeometry,
} from "./fins";
import { createBodyGeometry, writeBody } from "./geometry";
import { BODY_SAMPLES, creatureLive } from "./live";
import {
  createAccentMaterial,
  createBodyMaterial,
  createEyeMaterial,
  createFinMaterial,
  createGlowMaterial,
  type BodyUniforms,
} from "./materials";
import { bodyLength, clamp, lerp, ringRadii, swimOffset } from "./profiles";
import {
  buildFrames,
  followChain,
  idleModeForChapter,
  guardianRadius,
  idleTarget,
  orbitTarget,
  pondLimits,
  REF_ASPECT,
  steer,
  type Frame,
  type PondLimits,
  type SteerState,
} from "./spine";
import {
  makeCircuitTexture,
  makeDragonTexture,
  makeFinGlowTexture,
  makeFinTexture,
  makeKoiTexture,
  makeScaleBumpTexture,
} from "./textures";

export type FrameInput = {
  /** Seconds since the last frame. */
  dt: number;
  /** Seconds since the scene started. */
  time: number;
  camera: Camera;
  state: SceneState;
  /** Night (0) to day (1), already eased. Defaults to the theme in `state`. */
  day?: number;
  /** Canvas size in CSS pixels, to find where the creature is on screen. Without it the creature is never dimmed. */
  viewport?: { width: number; height: number };
};

export type CreatureRig = {
  /** Add this to the scene. */
  root: Group;
  /** The body mesh geometry (layout in geometry.ts), reusable for the point-cloud dissolve. */
  bodyGeometry: BufferGeometry;
  /** The body's skin and its shader uniforms (pattern fade, morph, time). */
  bodyMaterial: MeshStandardMaterial;
  bodyUniforms: BodyUniforms;
  /** Smoothed koi (0) to dragon (1) blend shown in the last frame. */
  readonly morph: number;
  /** How scattered the body is in the last frame, 0 (whole) to 1 (a cloud); it peaks halfway through the change. While above 0 the point cloud shows. */
  readonly scatter: number;
  /** 1 in the clear, down to the dim floor while the creature is under text (also what the cloud is drawn with). */
  readonly visibility: number;
  update(input: FrameInput): void;
  dispose(): void;
};

const FADE_SECONDS = 0.6;
/** Pointer still for this long: the koi goes back to wandering. */
const POINTER_IDLE_SECONDS = 2.5;
/** A koi darting at a pellet turns on a circle this share of its usual one, so it can reach one inside the usual circle. */
const FOOD_TURN_SCALE = 0.4;
/** Text protection: the creature fades to this share of its brightness while it swims under text. */
const DIM_FLOOR = 0.2;
/** The dragon, the climax of the page, is only dimmed this far: the veil behind the text still keeps the text readable, and the guardian circles a button that sits among blocks of text. */
const DIM_FLOOR_DRAGON = 0.7;
/** Speed of that fade, per second. */
const DIM_RATE = 5;
/** Feather (px) around a text block over which the creature fades. */
const DIM_FEATHER = 90;
/** Spine positions (0 snout to 1 tail tip) whose screen position decides how much text hides the creature. */
const DIM_SAMPLES = [0.04, 0.25, 0.5, 0.75, 0.96];
const MORPH_RATE = 4;
/** The change takes at least this long (seconds), however fast the page is scrolled: a jump to the end still plays out. */
const MORPH_MIN_SECONDS = 1.8;
/** From this far into chapter 5 the creature leaves the gate for the emptiest water on screen, where the change is staged. */
const STAGE_FROM = 0.22;
/** How often (seconds) the emptiest spot is looked for again, and how fast the head's goal glides to a new one (per second). */
const STAGE_REFRESH = 0.3;
const STAGE_FOLLOW = 1.6;
/** The guardian dragon's chapter. */
const GUARDIAN_CHAPTER = 6;
/** Where the call to action may be on screen for the dragon to circle it (share of the viewport): near an edge it circles the nearest spot inside. */
const GUARDIAN_MARGIN_X = 0.06;
const GUARDIAN_MARGIN_Y = 0.12;
/** The button counts as in sight while any of it lies between these shares of the screen's height. */
const GUARDIAN_SEEN_TOP = 0.08;
const GUARDIAN_SEEN_BOTTOM = 0.95;
/** How far the pond reaches towards the camera for the guardian's circle (a button at the bottom of the screen is under the camera). */
const GUARDIAN_Z_MAX = 3.2;
const SPIKES = 26;
/** Head rounding: rings before this u bulge to an ellipsoid of this depth (in u). */
const NOSE_U = 0.05;
const NOSE_DEPTH = 0.075;
const WHISKER_POINTS = 18;
/** Glowing flames behind the dragon's head and at the tip of its tail. */
const MANE = 9;
const TUFT = 5;
const GOLD = new Color(0xe0a84e);
const WHITE = new Color(0xffffff);
const UP = new Vector3(0, 1, 0);

/**
 * The procedural koi / dragon: a tube swept along a spine that chases a target, with fins, tail, dorsal fin,
 * spikes, horns, whiskers and eyes. Everything is allocated here once; `update` only writes into existing
 * buffers. A glTF creature can replace this module as long as it offers the same `root / update / dispose`.
 */
export function createCreatureRig(quality: CreatureQuality, opts: { maxAnisotropy?: number } = {}): CreatureRig {
  const N = quality.rings;
  const M = quality.sides;
  const root = new Group();
  root.name = "creature";
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const aniso = Math.max(1, Math.min(8, opts.maxAnisotropy ?? 4));
  const tex = <T extends Texture>(t: T) => {
    t.anisotropy = aniso;
    return own(t);
  };

  // --- textures (patterns are drawn once per variety and cached; textures are per rig) -------------------------
  const koiMaps = new Map<KoiVariety, Texture>();
  const finMaps = new Map<KoiVariety, Texture>();
  const koiMap = (v: KoiVariety) => koiMaps.get(v) ?? koiMaps.set(v, tex(makeKoiTexture(v))).get(v)!;
  const finMap = (v: KoiVariety) => finMaps.get(v) ?? finMaps.set(v, tex(makeFinTexture(v))).get(v)!;

  let variety: KoiVariety = "kohaku";
  let prevVariety: KoiVariety = variety;
  const dragonMap = tex(makeDragonTexture());
  const body = createBodyMaterial({
    koi: koiMap(variety),
    dragon: dragonMap,
    circuit: tex(makeCircuitTexture()),
    bump: tex(makeScaleBumpTexture()),
  });
  own(body.material);
  const fin = createFinMaterial(finMap(variety), tex(makeFinGlowTexture()));
  own(fin.material);
  const accent = own(createAccentMaterial());
  const glowMat = own(createGlowMaterial());
  const hideMat = own(
    new MeshStandardMaterial({ map: dragonMap, color: GOLD, metalness: 0.7, roughness: 0.3, envMapIntensity: 0.4 }),
  );
  const eyeMat = own(createEyeMaterial());
  const whiskerMat = own(new LineBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.9 }));

  // --- body ------------------------------------------------------------------------------------------------------
  const bodyGeometry = own(createBodyGeometry(N, M));
  const bodyMesh = new Mesh(bodyGeometry, body.material);
  bodyMesh.frustumCulled = false;
  bodyMesh.renderOrder = 0;
  root.add(bodyMesh);

  // --- fins ------------------------------------------------------------------------------------------------------
  const D = Math.PI / 180;
  const pecR = own(fanGeometry(16, 6, 100 * D, 168 * D, pectoralOutline, 1));
  const pecL = own(fanGeometry(16, 6, 100 * D, 168 * D, pectoralOutline, -1));
  const tailGeo = own(fanGeometry(24, 7, 140 * D, 220 * D, tailOutline, 1));
  const finMesh = (g: BufferGeometry) => {
    const m = new Mesh(g, fin.material);
    m.frustumCulled = false;
    m.renderOrder = 2;
    root.add(m);
    return m;
  };
  const finR = finMesh(pecR);
  const finL = finMesh(pecL);
  const pelR = finMesh(pecR);
  const pelL = finMesh(pecL);
  const tail = finMesh(tailGeo);

  const dorsalStart = Math.round(0.27 * (N - 1));
  const dorsalEnd = Math.round(0.6 * (N - 1));
  const dorsalCols = dorsalEnd - dorsalStart + 1;
  const dorsalGeo = own(ribbonGeometry(dorsalCols));
  const dorsal = finMesh(dorsalGeo);
  const dorsalPos = (dorsalGeo.getAttribute("position") as BufferAttribute).array as Float32Array;
  const dorsalNor = (dorsalGeo.getAttribute("normal") as BufferAttribute).array as Float32Array;

  // --- dragon parts ----------------------------------------------------------------------------------------------
  const instanced = (g: BufferGeometry, mat: Material, count: number) => {
    const mesh = new InstancedMesh(g, mat, count);
    mesh.frustumCulled = false;
    mesh.visible = false;
    root.add(mesh);
    return mesh;
  };
  const spikes = instanced(own(new ConeGeometry(0.045, 0.2, 8).translate(0, 0.08, 0)), glowMat, SPIKES);
  const horns = instanced(own(hornGeometry()), accent, 2);
  // Head plates (snout, jaw, two brows) are scaled spheres; legs carry their claws.
  const plates = instanced(own(new SphereGeometry(1, 24, 16)), hideMat, 4);
  const legs = instanced(own(legGeometry()), hideMat, 4);
  const flames = instanced(own(new ConeGeometry(0.028, 0.24, 6).translate(0, 0.12, 0)), glowMat, MANE + TUFT);
  const dragonParts = [spikes, horns, plates, legs, flames];
  const eyeGeo = own(new SphereGeometry(0.026, 16, 12));
  const eyes = new InstancedMesh(eyeGeo, eyeMat, 2);
  eyes.frustumCulled = false;
  root.add(eyes);
  const whiskers = [1, -1].map(() => {
    const g = own(new BufferGeometry());
    g.setAttribute("position", new BufferAttribute(new Float32Array(WHISKER_POINTS * 3), 3));
    const l = new Line(g, whiskerMat);
    l.frustumCulled = false;
    root.add(l);
    return l;
  });

  // --- simulation state -------------------------------------------------------------------------------------------
  const base = Array.from({ length: N }, (_, i) => new Vector3(-i * 0.015, 0, 0));
  const P = Array.from({ length: N }, () => new Vector3());
  const baseFrames: Frame[] = buildFrames(base);
  const frames: Frame[] = buildFrames(base);
  const RX = new Float32Array(N);
  const RY = new Float32Array(N);
  const radii = { rx: 0, ry: 0 };
  const swim = { lat: 0, lift: 0 };
  const steerState: SteerState = { head: new Vector3(), heading: 0 };
  const head = new Vector3();
  let heading = 0;
  let morph = 0;
  let scatter = 0;
  let fade = 1;
  let lastPointer: SceneState["pointer"] = null;
  let lastMove = -Infinity;
  let first = true;
  let visibility = 1;

  const target = new Vector3();
  const hit = new Vector3();
  const ndc = new Vector2();
  const hit2 = new Vector3();
  const stage = new Vector3();
  const stageSpot = { x: 0, y: 0 };
  let stageSpotAt = -Infinity;
  let hasStage = false;
  const center = new Vector3();
  const ray = new Raycaster();
  const water = new Plane(UP, 0);
  const tmp = new Vector3();
  const tmp2 = new Vector3();
  const vT = new Vector3();
  const vS = new Vector3();
  const vU = new Vector3();
  const m4 = new Matrix4();
  const xAxis = new Vector3();
  const yAxis = new Vector3();
  const zAxis = new Vector3();
  const dummy = new Object3D();
  const finColorA = new Color();
  const finColorB = new Color();
  const limits: PondLimits = { idleX: 0, idleZ: 0, pointerX: 0, zMin: 0, zMax: 0 };
  const samplePx = DIM_SAMPLES.map(() => ({ x: 0, y: 0 }));
  const sampleIndex = DIM_SAMPLES.map((u) => Math.round(u * (N - 1)));
  let prevHeadX = 0;
  let prevHeadZ = 0;

  const setFrameVectors = (i: number) => {
    const f = frames[i];
    vT.set(f.T.x, f.T.y, f.T.z);
    vS.set(f.S.x, f.S.y, f.S.z);
    vU.set(f.U.x, f.U.y, f.U.z);
  };

  /** Puts a fin mesh at spine point i (local x = forward, y = up, z = right), offset by (side, up) radii. */
  const placeFin = (obj: Object3D, i: number, side: number, up: number, back: number, scale: number) => {
    setFrameVectors(i);
    m4.makeBasis(vT, vU, vS);
    obj.quaternion.setFromRotationMatrix(m4);
    obj.position
      .copy(P[i])
      .addScaledVector(vS, side * RX[i])
      .addScaledVector(vU, up * RY[i])
      .addScaledVector(vT, -back);
    obj.scale.setScalar(Math.max(scale, 1e-4));
    obj.visible = scale > 0.01;
  };

  /** Writes instance k: at `pos`, oriented by the basis (x, y, z = x cross y), scaled per axis. */
  const setInstance = (
    mesh: InstancedMesh,
    k: number,
    pos: Vector3,
    x: Vector3,
    y: Vector3,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    zAxis.crossVectors(x, y);
    m4.makeBasis(x, y, zAxis);
    dummy.quaternion.setFromRotationMatrix(m4);
    dummy.position.copy(pos);
    dummy.scale.set(Math.max(sx, 1e-4), Math.max(sy, 1e-4), Math.max(sz, 1e-4));
    dummy.updateMatrix();
    mesh.setMatrixAt(k, dummy.matrix);
  };
  /** Sets yAxis along `dir` and xAxis to `hint` made perpendicular to it. */
  const axesFrom = (dir: Vector3, hint: Vector3) => {
    yAxis.copy(dir).normalize();
    xAxis.copy(hint).addScaledVector(yAxis, -hint.dot(yAxis));
    if (xAxis.lengthSq() < 1e-8) xAxis.set(1, 0, 0).addScaledVector(yAxis, -yAxis.x);
    xAxis.normalize();
  };

  function placeDragonParts(t: number, grow: number) {
    // Spines along the back, leaning back.
    for (let k = 0; k < SPIKES; k++) {
      const i = 4 + Math.floor((k * (N - 10)) / SPIKES);
      const u = i / (N - 1);
      setFrameVectors(i);
      tmp.copy(P[i]).addScaledVector(vU, RY[i] * 0.8);
      tmp2.copy(vU).addScaledVector(vT, -0.75);
      axesFrom(tmp2, vT);
      const sc = grow * (1.15 - u * 0.65);
      setInstance(spikes, k, tmp, xAxis, yAxis, sc, sc, sc);
    }
    spikes.instanceMatrix.needsUpdate = true;

    // Horns: back, up and out from the top of the head, curling upwards.
    const hi = Math.max(1, Math.round(0.03 * (N - 1)));
    setFrameVectors(hi);
    for (let q = 0; q < 2; q++) {
      const side = q === 0 ? 1 : -1;
      tmp2.copy(vT).multiplyScalar(-1).addScaledVector(vU, 0.75).addScaledVector(vS, side * 0.32);
      axesFrom(tmp2, vU);
      tmp.copy(P[hi]).addScaledVector(vU, RY[hi] * 0.55).addScaledVector(vS, side * RX[hi] * 0.45);
      const sc = grow * 1.35;
      setInstance(horns, q, tmp, xAxis, yAxis, sc, sc, sc);
    }
    horns.instanceMatrix.needsUpdate = true;

    // Head plates in the head frame (x forward along T, y up along U); sphere radii per axis.
    setFrameVectors(0);
    const nose = RX[0] * 1.7;
    tmp.copy(P[0]).addScaledVector(vT, nose * 0.45).addScaledVector(vU, RY[0] * 0.12);
    setInstance(plates, 0, tmp, vT, vU, 0.22 * grow, 0.085 * grow, 0.11 * grow);
    tmp.copy(P[0]).addScaledVector(vT, nose * 0.3).addScaledVector(vU, -RY[0] * 0.55);
    setInstance(plates, 1, tmp, vT, vU, 0.18 * grow, 0.05 * grow, 0.085 * grow);
    const ei = Math.max(1, Math.round(0.035 * (N - 1)));
    setFrameVectors(ei);
    for (let q = 0; q < 2; q++) {
      const side = q === 0 ? 1 : -1;
      tmp.copy(P[ei]).addScaledVector(vU, RY[ei] * 0.72).addScaledVector(vS, side * RX[ei] * 0.5);
      setInstance(plates, 2 + q, tmp, vT, vU, 0.09 * grow, 0.032 * grow, 0.045 * grow);
    }
    plates.instanceMatrix.needsUpdate = true;

    // Four legs: front pair at u 0.17, back pair at u 0.45, paddling through the air.
    for (let k = 0; k < 4; k++) {
      const i = Math.round((k < 2 ? 0.17 : 0.45) * (N - 1));
      const side = k % 2 === 0 ? 1 : -1;
      setFrameVectors(i);
      const swing = Math.sin(t * 2.4 + (k < 2 ? 0 : Math.PI) + (side > 0 ? 0 : Math.PI / 2)) * 0.35;
      tmp2.copy(vS).multiplyScalar(side * 0.75).addScaledVector(vU, -0.65).addScaledVector(vT, swing);
      axesFrom(tmp2, vT);
      tmp.copy(P[i]).addScaledVector(vS, side * RX[i] * 0.7).addScaledVector(vU, -RY[i] * 0.35);
      const sc = grow * 1.25;
      setInstance(legs, k, tmp, xAxis, yAxis, sc, sc, sc);
    }
    legs.instanceMatrix.needsUpdate = true;

    // Mane: flames fanning back from the upper half of the neck.
    for (let k = 0; k < MANE; k++) {
      const f = k / (MANE - 1);
      const i = Math.round((0.06 + (0.07 * (k % 3)) / 2) * (N - 1));
      const a = (20 + 140 * f) * (Math.PI / 180);
      setFrameVectors(i);
      tmp2.copy(vS).multiplyScalar(Math.cos(a) * RX[i]).addScaledVector(vU, Math.sin(a) * RY[i]);
      tmp.copy(P[i]).addScaledVector(tmp2, 0.85);
      tmp2.normalize().multiplyScalar(0.8).addScaledVector(vT, -1.2);
      axesFrom(tmp2, vT);
      const sc = grow * (0.9 + 0.25 * Math.sin(t * 6 + k * 1.7));
      setInstance(flames, k, tmp, xAxis, yAxis, sc, sc * (1.1 - 0.3 * Math.abs(f - 0.5)), sc);
    }
    // Tail tuft.
    setFrameVectors(N - 1);
    for (let k = 0; k < TUFT; k++) {
      const a = (k / (TUFT - 1) - 0.5) * 1.6;
      tmp2
        .copy(vT)
        .multiplyScalar(-1)
        .addScaledVector(vS, Math.sin(a) * 0.6)
        .addScaledVector(vU, Math.cos(a) * 0.25);
      axesFrom(tmp2, vU);
      const sc = grow * (1.4 - 0.4 * Math.abs(a)) * (0.9 + 0.2 * Math.sin(t * 5 + k));
      setInstance(flames, MANE + k, P[N - 1], xAxis, yAxis, sc, sc * 1.3, sc);
    }
    flames.instanceMatrix.needsUpdate = true;
  }

  /**
   * The dragon guards the call to action: the target is a point on an ellipse round the button, which is found on the
   * water by sending a ray through the middle of its box on the screen (and through its rim, for the size of the ring).
   * A button outside the screen counts as the nearest spot inside it. False when there is no button or no screen size.
   */
  function guardianTarget(
    state: SceneState,
    camera: Camera,
    viewport: FrameInput["viewport"],
    t: number,
    out: Vector3,
  ): boolean {
    const cta = state.cta;
    if (!cta || !viewport || !(viewport.width > 0) || !(viewport.height > 0)) return false;
    const { width: w, height: h } = viewport;
    // Scrolled out of sight (the section is taller than the screen): nothing to circle, so the dragon takes the open water.
    if (cta.y + cta.r < h * GUARDIAN_SEEN_TOP || cta.y - cta.r > h * GUARDIAN_SEEN_BOTTOM) return false;
    const cx = clamp(cta.x, w * GUARDIAN_MARGIN_X, w * (1 - GUARDIAN_MARGIN_X));
    const cy = clamp(cta.y, h * GUARDIAN_MARGIN_Y, h * (1 - GUARDIAN_MARGIN_Y));
    ndc.set((cx / w) * 2 - 1, -((cy / h) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(water, center)) return false;
    center.z = Math.min(center.z, GUARDIAN_Z_MAX);
    ndc.set(((cx + cta.r) / w) * 2 - 1, -((cy / h) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const rim = ray.ray.intersectPlane(water, hit2) ? Math.hypot(hit2.x - center.x, hit2.z - center.z) : 0;
    orbitTarget(center, t, guardianRadius(rim), out);
    return true;
  }

  /**
   * The change is staged on open water: the target is the emptiest place on the screen (see `findOpenSpot`: no text,
   * no card), put onto the pond, with a slow wander round it. The spot is looked for a few times a second and the
   * goal glides to it, so the creature takes a graceful turn when the page scrolls a card over it. False when the
   * screen size is unknown.
   */
  function stageTarget(state: SceneState, camera: Camera, viewport: FrameInput["viewport"], t: number, dt: number, out: Vector3): boolean {
    if (!viewport || !(viewport.width > 0) || !(viewport.height > 0)) return false;
    if (t - stageSpotAt > STAGE_REFRESH || t < stageSpotAt) {
      stageSpotAt = t;
      findOpenSpot(state.avoid, viewport.width, viewport.height, hasStage ? stageSpot : null, stageSpot);
    }
    ndc.set((stageSpot.x / viewport.width) * 2 - 1, -((stageSpot.y / viewport.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(water, hit2)) return false;
    hit2.x = clamp(hit2.x, -limits.pointerX, limits.pointerX);
    hit2.z = clamp(hit2.z, limits.zMin, limits.zMax);
    if (hasStage) {
      const k = 1 - Math.exp(-STAGE_FOLLOW * dt);
      stage.x += (hit2.x - stage.x) * k;
      stage.z += (hit2.z - stage.z) * k;
    } else {
      stage.set(hit2.x, 0, hit2.z);
      hasStage = true;
    }
    out.set(stage.x + Math.sin(t * 0.45) * 0.5, 0, stage.z + Math.cos(t * 0.37) * 0.3);
    return true;
  }

  function update({ dt: rawDt, time: t, camera, state, day: dayInput, viewport }: FrameInput) {
    const dt = clamp(rawDt, 0, 0.1);
    const frameScale = dt * 60;

    // Koi to dragon, eased so a jump in scroll position never snaps the shape.
    // It chases the scroll, but never faster than the change can be watched.
    const goal = transformState(state.chapter, state.t).morph;
    const chase = (goal - morph) * (1 - Math.exp(-dt * MORPH_RATE));
    const reach = dt / MORPH_MIN_SECONDS;
    morph += clamp(chase, -reach, reach);
    if (Math.abs(goal - morph) < 1e-4) morph = goal;
    const m = morph;
    // The cloud is the middle of the change, so it scatters and gathers on the same clock as the blend (the body
    // dissolves into it over the first part, and the dragon parts grow back out of it over the last).
    scatter = scatterAt(m);
    const dissolve = smoothstep(0.02, 0.32, scatter);
    const solid = 1 - smoothstep(0, 0.3, scatter);
    bodyMesh.visible = dissolve < 1;
    body.uniforms.uDissolve.value = dissolve;

    // Role change: the new pattern fades in over the old one.
    const nextVariety = varietyForRole(state.role);
    if (first) {
      // The first pattern appears as is: no fade from the default.
      first = false;
      variety = prevVariety = nextVariety;
      body.material.map = body.uniforms.uPrevMap.value = koiMap(variety);
      fin.material.map = fin.uniforms.uPrevMap.value = finMap(variety);
    } else if (nextVariety !== variety) {
      prevVariety = variety;
      variety = nextVariety;
      body.uniforms.uPrevMap.value = body.material.map;
      body.material.map = koiMap(variety);
      fin.uniforms.uPrevMap.value = fin.material.map;
      fin.material.map = finMap(variety);
      fade = 0;
    }
    fade = Math.min(1, fade + dt / FADE_SECONDS);
    const ease = fade * fade * (3 - 2 * fade);
    body.uniforms.uFade.value = ease;
    fin.uniforms.uFade.value = ease;

    // Target: the nearest pellet that has landed, else the pointer on the water, else the chapter's idle wander.
    // The pond is as wide as the screen allows: a portrait phone sees much less sideways.
    const aspect = (camera as { aspect?: number }).aspect || REF_ASPECT;
    pondLimits(aspect, m, limits);
    if (state.pointer !== lastPointer) {
      lastPointer = state.pointer;
      lastMove = t;
    }
    let turnScale = 1;
    const food = state.foods.length ? nearestFood(state.foods, head, t) : null;
    if (food) {
      target.set(food.x, 0, food.z);
      turnScale = FOOD_TURN_SCALE;
    } else {
      let follow = false;
      if (state.pointer && t - lastMove < POINTER_IDLE_SECONDS) {
        ndc.set(state.pointer.x, state.pointer.y);
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(water, hit)) {
          // Keep it in the pond, never right under the camera where it would fill the screen.
          target.set(clamp(hit.x, -limits.pointerX, limits.pointerX), 0, clamp(hit.z, limits.zMin, limits.zMax));
          follow = true;
        }
      }
      if (!follow) {
        const guarding = state.chapter >= GUARDIAN_CHAPTER && guardianTarget(state, camera, viewport, t, target);
        const staged = state.chapter >= GUARDIAN_CHAPTER || (state.chapter === DRAGON_CHAPTER && state.t >= STAGE_FROM);
        const staging = !guarding && staged && stageTarget(state, camera, viewport, t, dt, target);
        if (!guarding && !staging) idleTarget(t, m, target, { aspect, mode: idleModeForChapter(state.chapter) });
      }
    }

    prevHeadX = head.x;
    prevHeadZ = head.z;
    steer(head, heading, target, m, frameScale, steerState, turnScale);
    head.copy(steerState.head as Vector3);
    heading = steerState.heading;

    // Spine: follow the head, then add the swimming wave and the dragon's flight.
    followChain(base, head, bodyLength(m) / (N - 1));
    buildFrames(base, baseFrames);
    ringRadii(NOSE_U, m, radii);
    const noseRx = radii.rx;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      swimOffset(u, t, m, swim);
      const S = baseFrames[i].S;
      P[i].set(base[i].x + S.x * swim.lat, base[i].y + swim.lift, base[i].z + S.z * swim.lat);
      ringRadii(u, m, radii);
      // Round the head into an ellipsoid: the profile's steep first rings would otherwise leave a knob at the snout.
      let k = 1;
      if (u < NOSE_U) {
        const d = (NOSE_U - u) / NOSE_DEPTH;
        k = Math.max(1, (noseRx * Math.sqrt(1 - d * d)) / radii.rx);
      }
      RX[i] = radii.rx * k;
      RY[i] = radii.ry * k;
    }
    buildFrames(P, frames);
    writeBody(bodyGeometry, P, frames, RX, RY, lerp(0.6, 1.7, m));

    // Fins shrink away as the dragon takes over.
    const koi = 1 - m;
    const finScale = koi * koi * (3 - 2 * koi) * solid;
    const beat = t * 5;
    const pi = Math.round(0.19 * (N - 1));
    placeFin(finR, pi, 0.8, -0.25, 0, finScale);
    placeFin(finL, pi, -0.8, -0.25, 0, finScale);
    flexFan(pecR as FanGeometry, 0.32, beat, 2.2, -0.05, 0.05);
    flexFan(pecL as FanGeometry, -0.32, beat, 2.2, -0.05, 0.05);
    const qi = Math.round(0.5 * (N - 1));
    placeFin(pelR, qi, 0.6, -0.55, 0, finScale * 0.5);
    placeFin(pelL, qi, -0.6, -0.55, 0, finScale * 0.5);
    placeFin(tail, N - 1, 0, 0, RX[N - 1] * 0.6, finScale);
    flexFan(tailGeo as FanGeometry, 0.38, t * 7 - 1.2, 2.4, 0.02, 0.03);

    // Dorsal fin ribbon: tall at the front, low at the back, leaning back.
    for (let c = 0; c < dorsalCols; c++) {
      const i = dorsalStart + c;
      const s = c / (dorsalCols - 1);
      const h = 0.13 * finScale * Math.sin(Math.min(1, s / 0.18) * (Math.PI / 2)) * (1 - 0.7 * s) + 1e-4;
      setFrameVectors(i);
      for (let r = 0; r < 3; r++) {
        const f = r / 2;
        const ripple = Math.sin(t * 4 - s * 9) * 0.012 * f * finScale;
        tmp
          .copy(P[i])
          .addScaledVector(vU, RY[i] * 0.9 + h * f * 0.85)
          .addScaledVector(vT, -h * f * 0.55)
          .addScaledVector(vS, ripple);
        const k = (c * 3 + r) * 3;
        dorsalPos[k] = tmp.x;
        dorsalPos[k + 1] = tmp.y;
        dorsalPos[k + 2] = tmp.z;
        // The fin stands on the back, so it faces sideways.
        dorsalNor[k] = vS.x;
        dorsalNor[k + 1] = vS.y;
        dorsalNor[k + 2] = vS.z;
      }
    }
    dorsalGeo.getAttribute("position").needsUpdate = true;
    dorsalGeo.getAttribute("normal").needsUpdate = true;
    dorsal.visible = finScale > 0.01;

    // Dragon: spines, horns, head plates, legs, mane and tail flames. Hidden while it is a koi.
    const grow = m * m * (3 - 2 * m) * solid;
    const dragonVisible = m > 0.01 && grow > 0.003;
    for (const mesh of dragonParts) mesh.visible = dragonVisible;
    if (dragonVisible) placeDragonParts(t, grow);

    // Eyes on the sides of the head; they glow once it is a dragon.
    const ei = Math.max(1, Math.round(0.035 * (N - 1)));
    setFrameVectors(ei);
    for (let q = 0; q < 2; q++) {
      const side = q === 0 ? 1 : -1;
      dummy.position
        .copy(P[ei])
        .addScaledVector(vS, side * RX[ei] * 0.8)
        .addScaledVector(vU, RY[ei] * 0.38)
        .addScaledVector(vT, RX[ei] * 0.15 * m);
      dummy.quaternion.identity();
      dummy.scale.setScalar(Math.max(1e-4, lerp(1, 1.8, m) * solid));
      dummy.updateMatrix();
      eyes.setMatrixAt(q, dummy.matrix);
    }
    eyes.visible = solid > 0.003;
    eyes.instanceMatrix.needsUpdate = true;

    // Whiskers: from the muzzle, out to the side, then streaming back along the body with a slow wave.
    setFrameVectors(0);
    const nose = RX[0] * lerp(0.6, 1.7, m);
    for (let q = 0; q < 2; q++) {
      const line = whiskers[q];
      line.visible = m > 0.05 && solid > 0.003;
      if (!line.visible) continue;
      const side = q === 0 ? 1 : -1;
      const arr = (line.geometry.getAttribute("position") as BufferAttribute).array as Float32Array;
      for (let k = 0; k < WHISKER_POINTS; k++) {
        const s = k / (WHISKER_POINTS - 1);
        tmp
          .copy(P[0])
          .addScaledVector(vT, nose * 0.75 + (0.12 * s - 0.95 * s * s) * m)
          .addScaledVector(vS, side * (RX[0] * 0.45 + 0.38 * s * m))
          .addScaledVector(vU, -RY[0] * 0.15 + (Math.sin(t * 2.6 - s * 6 + q) * 0.06 * s + 0.04 * s) * m);
        arr[k * 3] = tmp.x;
        arr[k * 3 + 1] = tmp.y;
        arr[k * 3 + 2] = tmp.z;
      }
      line.geometry.getAttribute("position").needsUpdate = true;
    }

    // Materials.
    const surfA = VARIETY_SURFACE[prevVariety];
    const surfB = VARIETY_SURFACE[variety];
    const day = dayInput ?? (state.theme === "light" ? 1 : 0);
    const glowScale = lerp(1, 0.55, day);

    // Text protection: dim the creature while its body is under a block of text (the veil does the rest per pixel).
    let wantVisible = 1;
    const screen = creatureLive.screen;
    screen.valid = false;
    if (viewport) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let k = 0; k < sampleIndex.length; k++) {
        tmp.copy(P[sampleIndex[k]]).project(camera);
        const px = (tmp.x * 0.5 + 0.5) * viewport.width;
        const py = (0.5 - tmp.y * 0.5) * viewport.height;
        samplePx[k].x = px;
        samplePx[k].y = py;
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (py < y0) y0 = py;
        if (py > y1) y1 = py;
      }
      // A cloud reaches far beyond the body: widen the box by how far it flies, in pixels at the body's distance.
      if (scatter > 0) {
        const dist = Math.max(0.5, camera.position.distanceTo(P[sampleIndex[2]]));
        const fly = (scatter * SCATTER_SPREAD * 0.5 * viewport.height * camera.projectionMatrix.elements[5]) / dist;
        x0 -= fly;
        y0 -= fly;
        x1 += fly;
        y1 += fly;
      }
      screen.x0 = x0;
      screen.y0 = y0;
      screen.x1 = x1;
      screen.y1 = y1;
      screen.valid = true;
      if (state.avoid.length) wantVisible = creatureVisibility(state.avoid, samplePx, DIM_FEATHER, lerp(DIM_FLOOR, DIM_FLOOR_DRAGON, m));
    }
    visibility = dampValue(visibility, wantVisible, DIM_RATE, dt);
    const shade = 0.3 + 0.7 * visibility;
    body.uniforms.uTime.value = t;
    body.uniforms.uMorph.value = m;
    body.material.color.copy(WHITE).lerp(GOLD, m).multiplyScalar(shade);
    body.material.metalness = lerp(lerp(surfA.metalness, surfB.metalness, ease), 0.7, m);
    body.material.roughness = lerp(lerp(surfA.roughness, surfB.roughness, ease), 0.28, m);
    body.material.emissiveIntensity = (0.8 + 0.35 * Math.sin(t * 2.2) + 0.4 * m) * glowScale * visibility;
    body.material.envMapIntensity = lerp(0.5, 0.35, m);
    glowMat.emissiveIntensity = (1.2 + 0.4 * Math.sin(t * 3.1)) * glowScale * visibility;
    fin.material.color.copy(finColorA.set(surfA.fin)).lerp(finColorB.set(surfB.fin), ease).multiplyScalar(shade);
    eyeMat.emissiveIntensity = m * 3 * glowScale * visibility;

    creatureLive.morph = m;
    creatureLive.scatter = scatter;
    creatureLive.head.x = P[0].x;
    creatureLive.head.y = P[0].y;
    creatureLive.head.z = P[0].z;
    creatureLive.tail.x = P[N - 1].x;
    creatureLive.tail.y = P[N - 1].y;
    creatureLive.tail.z = P[N - 1].z;
    // How fast the head moves, in pond units per second (wakes and ripples follow it).
    creatureLive.speed = dt > 0 ? Math.hypot(head.x - prevHeadX, head.z - prevHeadZ) / dt : 0;
    creatureLive.visibility = visibility;
    for (let k = 0; k < BODY_SAMPLES; k++) {
      const i = Math.round((k / (BODY_SAMPLES - 1)) * (N - 1));
      creatureLive.body[k * 3] = P[i].x;
      creatureLive.body[k * 3 + 1] = P[i].y;
      creatureLive.body[k * 3 + 2] = P[i].z;
    }
  }

  return {
    root,
    bodyGeometry,
    bodyMaterial: body.material,
    bodyUniforms: body.uniforms,
    get morph() {
      return morph;
    },
    get scatter() {
      return scatter;
    },
    get visibility() {
      return visibility;
    },
    update,
    dispose() {
      for (const d of disposables) d.dispose();
      for (const mesh of [spikes, horns, plates, legs, flames, eyes]) mesh.dispose();
    },
  };
}
