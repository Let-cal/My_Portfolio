import {
  BackSide,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
} from "three";
import { GARDEN_CELESTIAL, gardenSkyWeight } from "../garden";
import { GARDEN_NIGHT_GLSL as night } from "../garden-palette";
import { createOwner } from "./types";

/** Procedural 3D sky dome, plus a physical sun/moon sphere. No panorama, billboard or reflection render target. */
export function createGardenSky(own: ReturnType<typeof createOwner>["own"]) {
  const root = new Group();
  const material = own(
    new ShaderMaterial({
      side: BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      uniforms: { uDay: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: `varying vec3 vDirection;
      void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uDay; uniform float uOpacity; varying vec3 vDirection;
      void main() {
        vec3 direction = normalize(vDirection);
        float altitude = smoothstep(-0.08, 0.5, direction.y);
        vec3 night = mix(${night.horizon}, ${night.sky}, altitude);
        vec3 dawn = mix(vec3(0.94, 0.78, 0.57), vec3(0.36, 0.63, 0.76), altitude);
        vec3 lightDirection = normalize(vec3(${GARDEN_CELESTIAL.map((n) => n.toFixed(1)).join(", ")}));
        float halo = pow(max(dot(direction, lightDirection), 0.0), mix(200.0, 32.0, uDay));
        vec3 color = mix(night, dawn, uDay) + mix(${night.halo}, vec3(0.32, 0.19, 0.05), uDay) * halo;
        gl_FragColor = vec4(color, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  );
  const sky = new Mesh(own(new SphereGeometry(45, 24, 16)), material);
  sky.name = "garden-sky";
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  const discMaterial = own(
    new MeshBasicMaterial({
      color: 0xffe6ae,
      transparent: true,
      fog: false,
      depthWrite: false,
    }),
  );
  const body = new Mesh(own(new SphereGeometry(0.85, 24, 16)), discMaterial);
  body.name = "garden-sun-moon";
  body.position.set(...GARDEN_CELESTIAL);
  body.renderOrder = -90;
  root.add(sky, body);
  const moon = new Color(0xd6e8f3),
    sun = new Color(0xffd49a);
  return {
    root,
    update(position: number, day: number) {
      const weight = gardenSkyWeight(position);
      root.visible = weight > 0.001;
      material.uniforms.uDay.value = day;
      material.uniforms.uOpacity.value = weight;
      discMaterial.color.copy(moon).lerp(sun, day);
      discMaterial.opacity = weight;
    },
  };
}
