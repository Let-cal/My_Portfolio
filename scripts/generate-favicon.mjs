import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// ICO supports embedded PNG entries. Keep the fallback icon aligned with the source SVG.
const source = new URL("../src/app/icon.svg", import.meta.url);
const svg = await readFile(source);
const sizes = [32, 48, 64];
const images = await Promise.all(
  sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(
  new URL("../src/app/favicon.ico", import.meta.url),
  Buffer.concat([header, ...images]),
);
console.log(`Generated koi favicon: ${offset} bytes, ${sizes.join("/")} px`);
