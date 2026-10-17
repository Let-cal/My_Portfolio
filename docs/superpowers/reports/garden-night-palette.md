# Garden night palette A — obsidian, moon silver and amber

## Approved scope

The user approved option A on 2026-10-15. Retain the existing 3D garden, camera path, lotus continuity, waterfall animation, submerged circuitry and stable Skills reading surfaces. Harmonize the dark Projects/Skills scenery with the black cyber pond in adjacent chapters. Daylight colors and the other chapters' grid remain unchanged.

## Shared palette

| Surface | Authored sRGB |
| --- | --- |
| Night sky | `#04070b` |
| Horizon and fog | `#0b1318` |
| Pond depth | `#091217` |
| Falling-water shadow | `#101e26` |
| Moonlit foam | `#6b828a` |

`garden-palette.ts` decodes the sRGB colors once through Three.js Color and bakes linear GLSL literals at module load. Stage fog, the sky dome and the water's reflected sky share the same horizon. The previous garden horizon used linear RGB `(0.075, 0.13, 0.18)` directly, which made the night scenery considerably brighter and bluer than the surrounding cyber scene.

The moon halo and submerged grid retain deliberately authored linear emission values. The grid now carries a restrained warm tint matching the circuit lines outside the garden. Lanterns remain amber and the waterfall retains local silver highlights.

## Lighting and transitions

- Reduce the garden's night environment intensity to 65%; interpolate with the existing continuous garden weight and day/night blend.
- Preserve environment intensity outside the garden and in daylight.
- Reduce only the moon's night reflection to 25%; retain the existing sunlight reflection.
- Narrow the lantern reflection lobes and reduce their pools, keeping the lamps readable without a broad wash over the pond.
- Reuse the existing forward/reverse camera path and theme transition. No new models, textures, lights, reflection render targets or postprocessing passes.

## Verification

- Production build and TypeScript: pass; ESLint: pass.
- Full unit suite: 784 cases pass. Two palette regressions first failed against the previous sky/waterfall shaders, then passed with the shared colors.
- Full production browser suite: 47 cases pass, including light/dark Skills wheel-scroll stability and the new palette/theme/neighbor restoration case. The latter first failed against the old production server (environment intensity 1 instead of 0.65).
- Build-artifact checks: 18 pass. Initial home JavaScript remains 199.9 KB gzip for EN/JA/VI (200 KB budget); quick view is 176.3 KB.
- Captured both themes through Experience → Projects → Skills → Certificates and back. No page/console errors in the capture run. Local artifacts: `.superpowers/sdd/2026-10-13-portfolio-koi-redesign/veil-debug/palette-a-*`.
- Desktop D3D11, 1440×900, low-tier 4-core profile: 90 steady-state samples per theme measured approximately 60 rendered frames/s, 31 draw calls and 161,240 triangles per frame. This is not a physical-mobile GPU measurement.

The browser regression checks the compiled sky/water shaders, uploaded fog colors, night/day environment values and restoration of neighboring chapters. Independent review caught a test color-space mismatch: on the low tier, Three.js uploads unlit fog colors in output sRGB; custom shader constants remain linear. The probe now asserts each in the appropriate space.

The separate mobile Lighthouse release gate remains open. This palette correction does not establish that the FE is ready to merge or deploy.

## References

- [Three.js color management](https://threejs.org/manual/pages/color-management.html)
- [Three.js fog](https://threejs.org/manual/pages/fog.html)
- [JNTO Rikugien Garden](https://www.japan.travel/en/spot/1693/)
- [JNTO Yuushien Garden illuminations](https://www.japan.travel/en/japans-local-treasures/yuushien-garden-illuminations/)
