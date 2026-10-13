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
import { transformState } from "../chapters";
import type { SceneState } from "../store";
import { varietyForRole, VARIETY_SURFACE, type CreatureQuality } from "./config";
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
import { creatureLive } from "./live";
import {
  createAccentMaterial,
  createBodyMaterial,
  createEyeMaterial,
  createFinMaterial,
  createGlowMaterial,
  type BodyUniforms,
} from "./materials";
import { bodyLength, clamp, lerp, ringRadii, swimOffset } from "./profiles";
import { buildFrames, followChain, idleTarget, steer, type Frame, type SteerState } from "./spine";
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
  update(input: FrameInput): void;
  dispose(): void;
};

const FADE_SECONDS = 0.6;
/** Pointer still for this long: the koi goes back to wandering. */
const POINTER_IDLE_SECONDS = 2.5;
const MORPH_RATE = 4;
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
  let fade = 1;
  let lastPointer: SceneState["pointer"] = null;
  let lastMove = -Infinity;
  let first = true;

  const target = new Vector3();
  const hit = new Vector3();
  const ndc = new Vector2();
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

  function update({ dt: rawDt, time: t, camera, state }: FrameInput) {
    const dt = clamp(rawDt, 0, 0.1);
    const frameScale = dt * 60;

    // Koi to dragon, eased so a jump in scroll position never snaps the shape.
    const goal = transformState(state.chapter, state.t).morph;
    morph += (goal - morph) * (1 - Math.exp(-dt * MORPH_RATE));
    if (Math.abs(goal - morph) < 1e-4) morph = goal;
    const m = morph;

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

    // Target: the pointer on the water, or an idle figure of eight.
    if (state.pointer !== lastPointer) {
      lastPointer = state.pointer;
      lastMove = t;
    }
    let follow = false;
    if (state.pointer && t - lastMove < POINTER_IDLE_SECONDS) {
      ndc.set(state.pointer.x, state.pointer.y);
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(water, hit)) {
        // Keep it in the pond, never right under the camera where it would fill the screen.
        target.set(clamp(hit.x, -4.5, 4.5), 0, clamp(hit.z, -3, 1.6));
        follow = true;
      }
    }
    if (!follow) idleTarget(t, m, target);

    steer(head, heading, target, m, frameScale, steerState);
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
    const finScale = koi * koi * (3 - 2 * koi);
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
    const dragonVisible = m > 0.01;
    const grow = m * m * (3 - 2 * m);
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
      dummy.scale.setScalar(lerp(1, 1.8, m));
      dummy.updateMatrix();
      eyes.setMatrixAt(q, dummy.matrix);
    }
    eyes.instanceMatrix.needsUpdate = true;

    // Whiskers: from the muzzle, out to the side, then streaming back along the body with a slow wave.
    setFrameVectors(0);
    const nose = RX[0] * lerp(0.6, 1.7, m);
    for (let q = 0; q < 2; q++) {
      const line = whiskers[q];
      line.visible = m > 0.05;
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
    const glowScale = state.theme === "light" ? 0.55 : 1;
    body.uniforms.uTime.value = t;
    body.uniforms.uMorph.value = m;
    body.material.color.copy(WHITE).lerp(GOLD, m);
    body.material.metalness = lerp(lerp(surfA.metalness, surfB.metalness, ease), 0.7, m);
    body.material.roughness = lerp(lerp(surfA.roughness, surfB.roughness, ease), 0.28, m);
    body.material.emissiveIntensity = (0.8 + 0.35 * Math.sin(t * 2.2) + 0.4 * m) * glowScale;
    body.material.envMapIntensity = lerp(0.5, 0.35, m);
    glowMat.emissiveIntensity = (1.2 + 0.4 * Math.sin(t * 3.1)) * glowScale;
    fin.material.color.copy(finColorA.set(surfA.fin)).lerp(finColorB.set(surfB.fin), ease);
    eyeMat.emissiveIntensity = m * 3 * glowScale;

    creatureLive.morph = m;
    creatureLive.head.x = P[0].x;
    creatureLive.head.y = P[0].y;
    creatureLive.head.z = P[0].z;
  }

  return {
    root,
    bodyGeometry,
    bodyMaterial: body.material,
    bodyUniforms: body.uniforms,
    get morph() {
      return morph;
    },
    update,
    dispose() {
      for (const d of disposables) d.dispose();
      for (const mesh of [spikes, horns, plates, legs, flames, eyes]) mesh.dispose();
    },
  };
}
