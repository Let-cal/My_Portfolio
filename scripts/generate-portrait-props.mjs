import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const { getImageProps } = require("next/image");
const roles = { fullstack: "developer", techlead: "techlead", pm: "pm" };
const check = process.argv.includes("--check");
const portraits = {};
const sizes = "(min-width: 1024px) 376px, (min-width: 450px) 308px, 68.36vw";
if (!check) mkdirSync("public/images/roles/optimized", { recursive: true });
for (const [role, filename] of Object.entries(roles)) {
  const src = `/images/roles/role-${filename}.webp`;
  if (!existsSync(`public${src}`)) throw new Error(`Missing portrait ${src}`);
  const candidates = [];
  for (const width of [384, 512, 772]) {
    const url = `/images/roles/optimized/role-${filename}-${width}.avif`;
    const encoded = await sharp(`public${src}`).resize({ width }).avif({ quality: 50, effort: 4 }).toBuffer();
    if (check) {
      if (!existsSync(`public${url}`) || !readFileSync(`public${url}`).equals(encoded)) throw new Error(`Stale portrait ${url}`);
    } else if (!existsSync(`public${url}`) || !readFileSync(`public${url}`).equals(encoded)) {
      writeFileSync(`public${url}`, encoded);
    }
    candidates.push(`${url} ${width}w`);
  }
  const { props } = getImageProps({ src: candidates.at(-1).split(" ")[0], alt: "", fill: true, unoptimized: true });
  portraits[role] = { ...props, sizes, srcSet: candidates.join(", ") };
}
const output = new URL("../src/content/role-portraits.json", import.meta.url);
const json = JSON.stringify(portraits, null, 2) + "\n";
if (check) {
  if (readFileSync(output, "utf8") !== json) throw new Error("Portrait attributes are stale; run npm run prebuild");
} else {
  writeFileSync(output, json);
}
