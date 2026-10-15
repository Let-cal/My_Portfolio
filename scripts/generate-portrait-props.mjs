import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { getImageProps } = require("next/image");
const roles = { fullstack: "developer", techlead: "techlead", pm: "pm" };
const portraits = Object.fromEntries(Object.entries(roles).map(([role, filename]) => {
  const src = `/images/roles/role-${filename}.webp`;
  if (!existsSync(`public${src}`)) throw new Error(`Missing portrait ${src}`);
  const { props } = getImageProps({ src, alt: "", fill: true, sizes: "(min-width: 1024px) 440px, min(360px, 80vw)" });
  return [role, props];
}));
const output = new URL("../src/content/role-portraits.json", import.meta.url);
const json = JSON.stringify(portraits, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== json) throw new Error("Portrait attributes are stale; run npm run prebuild");
} else {
  writeFileSync(output, json);
}
