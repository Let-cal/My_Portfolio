// Manual asset preparation only; production builds use the committed, optimized files offline.
import { mkdirSync, writeFileSync } from "node:fs";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const root = "public/scene/waterfall/rocks";
mkdirSync(root, { recursive: true });
const get = async (url) => {
  const response = await fetch(url, {
    headers: { "User-Agent": "LetcalPortfolioAssetResearch/1.0" },
  });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
};
const files = JSON.parse(
  (await get("https://api.polyhaven.com/files/rock_moss_set_01")).toString(),
);
const source = files.gltf["1k"].gltf;
const original = JSON.parse((await get(source.url)).toString());
const includes = source.include;
const binaryKey = Object.keys(includes).find((key) => key.endsWith(".bin"));
const binary = await get(includes[binaryKey].url);
await MeshoptSimplifier.ready;
const output = {
  asset: { version: "2.0", generator: "Letcal offline rock simplification" },
  scene: 0,
  scenes: [{ nodes: [0, 1, 2] }],
  nodes: [],
  meshes: [],
  accessors: [],
  bufferViews: [],
  buffers: [],
  images: [{ uri: "albedo.jpg" }, { uri: "normal.jpg" }],
  textures: [{ source: 0 }, { source: 1 }],
  materials: [
    {
      name: "CC0 mossy forest stone",
      normalTexture: { index: 1 },
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.95,
      },
    },
  ],
};
const chunks = [];
let offset = 0;
function readAccessor(index) {
  const a = original.accessors[index],
    view = original.bufferViews[a.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[
    a.componentType
  ];
  if (!Type || view.byteStride)
    throw new Error("Unexpected source accessor layout");
  const start = (view.byteOffset || 0) + (a.byteOffset || 0);
  const slice = binary.subarray(
    start,
    start + a.count * width * Type.BYTES_PER_ELEMENT,
  );
  return new Type(
    slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength),
  );
}
function addAccessor(data, width, position = false) {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    offset += pad;
  }
  const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  output.bufferViews.push({
    buffer: 0,
    byteOffset: offset,
    byteLength: bytes.length,
  });
  const accessor = {
    bufferView: output.bufferViews.length - 1,
    componentType: data instanceof Float32Array ? 5126 : 5123,
    count: data.length / width,
    type: width === 1 ? "SCALAR" : `VEC${width}`,
  };
  if (position) {
    accessor.min = [Infinity, Infinity, Infinity];
    accessor.max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < data.length; i++) {
      const axis = i % 3;
      accessor.min[axis] = Math.min(accessor.min[axis], data[i]);
      accessor.max[axis] = Math.max(accessor.max[axis], data[i]);
    }
  }
  output.accessors.push(accessor);
  chunks.push(bytes);
  offset += bytes.length;
  return output.accessors.length - 1;
}
const stats = [];
for (const sourceIndex of [0, 2, 5]) {
  const primitive = original.meshes[sourceIndex].primitives[0];
  const positions = readAccessor(primitive.attributes.POSITION);
  const input = new Uint32Array(readAccessor(primitive.indices));
  const [indices, error] = MeshoptSimplifier.simplify(
    input,
    positions,
    3,
    2400,
    0.02,
  );
  const [remap, count] = MeshoptSimplifier.compactMesh(indices);
  if (count > 65535) throw new Error("Rock exceeds uint16 vertex budget");
  const attributes = {};
  for (const [name, index] of Object.entries(primitive.attributes)) {
    if (!["POSITION", "NORMAL", "TEXCOORD_0"].includes(name)) continue;
    const width = name === "TEXCOORD_0" ? 2 : 3;
    const before = readAccessor(index),
      compact = new Float32Array(count * width);
    for (let old = 0; old < remap.length; old++) {
      const next = remap[old];
      if (next >= count) continue;
      for (let j = 0; j < width; j++)
        compact[next * width + j] = before[old * width + j];
    }
    attributes[name] = addAccessor(compact, width, name === "POSITION");
  }
  const mesh = output.meshes.length;
  output.meshes.push({
    name: `moss-rock-${mesh}`,
    primitives: [
      {
        attributes,
        indices: addAccessor(new Uint16Array(indices), 1),
        material: 0,
      },
    ],
  });
  output.nodes.push({ mesh, name: `moss-rock-${mesh}` });
  stats.push({
    sourceIndex,
    beforeTriangles: input.length / 3,
    afterTriangles: indices.length / 3,
    vertices: count,
    error,
  });
}
output.buffers = [{ uri: "rocks.bin", byteLength: offset }];
writeFileSync(`${root}/rocks.bin`, Buffer.concat(chunks));
writeFileSync(`${root}/rocks.gltf`, JSON.stringify(output));
for (const [needle, target] of [
  ["_diff_", "albedo.jpg"],
  ["_nor_gl_", "normal.jpg"],
]) {
  const key = Object.keys(includes).find((name) => name.includes(needle));
  writeFileSync(`${root}/${target}`, await get(includes[key].url));
}
writeFileSync(
  `${root}/provenance.json`,
  JSON.stringify(
    {
      asset: "Rock Moss Set 01",
      author: "Kless Gyzen",
      license: "CC0-1.0",
      source: "https://polyhaven.com/a/rock_moss_set_01",
      metadata: "https://api.polyhaven.com/files/rock_moss_set_01",
      supportingMaterials: [
        {
          asset: "Cliff Side",
          source: "https://polyhaven.com/a/cliff_side",
          license: "CC0-1.0",
          resolution: 512,
        },
      ],
      stats,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ geometryBytes: offset, stats }, null, 2));
// Seamless scanned PBR surface for the solid cliff, not a picture of a landscape.
const cliff = JSON.parse(
  (await get("https://api.polyhaven.com/files/cliff_side")).toString(),
);
for (const [kind, target] of [
  ["Diffuse", "cliff-albedo.jpg"],
  ["nor_gl", "cliff-normal.jpg"],
]) {
  const input = await get(cliff[kind]["1k"].jpg.url);
  await sharp(input)
    .resize(512, 512)
    .jpeg({ quality: kind === "nor_gl" ? 88 : 80 })
    .toFile(`${root}/${target}`);
}
