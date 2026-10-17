# Skills waterfall: 3D environment revision

## Binding decision

The owner rejected the 2.5D image plate. Real photographs may inform composition, but no full-scene photograph or generated image is used as the environment. The rejected plate and its runtime code were removed from production. The target is a coherent Japanese 3D art style matching the koi and lotus, rather than photographic realism at any cost.

## Scene construction

- Solid sculpted cliff mesh with real depth and a wet, rough stone material.
- Three optimized, scanned moss-rock meshes from Poly Haven, instanced into the cliff banks. Source: Rock Moss Set 01 by Kless Gyzen, CC0-1.0.
- Individually modeled curved maple trunks and branches, merged into one draw call; hundreds of folded five-lobed leaves use instancing and autumn colors. No spherical foliage clumps or scenery billboards.
- A tessellated cascade bends over two stone terraces in actual 3D, with shader flow, foam and a landing basin. It is an art-directed water surface, not a fluid simulation.
- An oblique camera shows the depth between the water, rock banks and trees; existing chapter camera transitions, day/night and text protection remain.

## Offline asset pipeline

Run `node scripts/prepare-waterfall-rocks.mjs` manually to regenerate the committed assets. Production builds do not contact Poly Haven. meshoptimizer 1.1.1 is a pinned development dependency used only during asset preparation.

Three source rocks originally total 24,994 triangles. Each was simplified to 800 triangles, giving 2,400 total, with measured relative simplification errors below 1.1%. Geometry is 66,720 bytes. The diffuse and normal maps are the source 1K JPEGs (168,099 and 209,975 bytes). The solid cliff uses the separate CC0 Cliff Side surface material, resized to 512px (50,416-byte albedo and 97,076-byte normal map). Total model/material files plus metadata are 595,865 bytes, below the 650KB deferred asset budget. These are UV surface maps, not pictures of a complete landscape.

Models and maps are requested during the approach to Skills, not on initial page load. Failed loads retain a lightweight geometric fallback without retrying every frame. Late results must release resources if the scene has already unmounted.

## References and credits

- https://polyhaven.com/a/rock_moss_set_01
- https://polyhaven.com/a/cliff_side
- https://polyhaven.com/license
- https://polyhaven.com/our-api
- https://github.com/zeux/meshoptimizer
- https://www.japan.travel/en/japans-local-treasures/fukuroda-falls/

Fukuroda and the owner's reference photos inform layered rock, maple foliage and tiered-water composition; the scene does not claim to reproduce a particular real location. Poly Haven assets remain CC0 and their authorship is not claimed by this portfolio.

## Release gates

Production build, lint, unit tests, deferred model loading, shader errors, before/after scroll stability and browser screenshots must be checked. Initial-JS budget last reached 199.8KB gzip; Lighthouse performance/LCP remain open. Do not mark the FE complete or merge/deploy while these gates remain unmet.
