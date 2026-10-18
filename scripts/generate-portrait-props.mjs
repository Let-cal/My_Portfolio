import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const { getImageProps } = require("next/image");
const roles = { fullstack: "developer", techlead: "techlead", pm: "pm" };
const check = process.argv.includes("--check");
const committed = process.argv.includes('--use-committed');
function optionalRead(path) {
  try { return readFileSync(path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
}
const portraits = {};
const sizes = "(min-width: 1024px) 376px, (min-width: 450px) 308px, 68.36vw";
if (!check && !committed) mkdirSync("public/images/roles/optimized", { recursive: true });
for (const [role, filename] of Object.entries(roles)) {
  const src = `/images/roles/role-${filename}.webp`;
  const source = readFileSync(`public${src}`);
  const sourceMetadata = committed ? await sharp(source).metadata() : null;
  const candidates = [];
  for (const width of [384, 512, 772]) {
    const url = `/images/roles/optimized/role-${filename}-${width}.avif`;
    const current = optionalRead(`public${url}`);
    if (committed) {
      if (!current) throw new Error(`Missing committed portrait ${url}; run npm run generate:assets`);
      const metadata = await sharp(current).metadata();
      if (metadata.format !== 'heif' || metadata.width !== width || metadata.height !== Math.round(sourceMetadata.height * width / sourceMetadata.width)) throw new Error(`Invalid committed portrait ${url}`);
    } else {
      const encoded = await sharp(source).resize({ width }).avif({ quality: 50, effort: 4 }).toBuffer();
      if (check) {
        if (!current?.equals(encoded)) throw new Error(`Stale portrait ${url}`);
      } else if (!current?.equals(encoded)) writeFileSync(`public${url}`, encoded);
    }
    candidates.push(`${url} ${width}w`);
  }
  const { props } = getImageProps({ src: candidates.at(-1).split(" ")[0], alt: "", fill: true, unoptimized: true });
  portraits[role] = { ...props, sizes, srcSet: candidates.join(", ") };
}
const output = new URL("../src/content/role-portraits.json", import.meta.url);
const json = JSON.stringify(portraits, null, 2) + "\n";
if (check || committed) {
  if (readFileSync(output, "utf8") !== json) throw new Error("Portrait attributes are stale; run npm run prebuild");
} else {
  writeFileSync(output, json);
}
