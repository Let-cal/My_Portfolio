import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

// Re-encode the existing scene captures; keep JPEGs as the native picture fallback.
for (const name of ["koi-day", "koi-night", "dragon-day", "dragon-night"]) {
  const path = `public/fallback/${name}.avif`;
  let current = null;
  try {
    current = readFileSync(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (process.argv.includes("--use-committed")) {
    if (!current)
      throw new Error(
        `Missing committed image ${path}; run npm run generate:assets`,
      );
    const source = await sharp(`public/fallback/${name}.jpg`).metadata();
    const output = await sharp(current).metadata();
    if (
      output.format !== "heif" ||
      output.width !== source.width ||
      output.height !== source.height
    )
      throw new Error(`Invalid committed image ${path}`);
    continue;
  }
  const encoded = await sharp(`public/fallback/${name}.jpg`)
    .avif({ quality: 65, effort: 4, chromaSubsampling: "4:4:4" })
    .toBuffer();
  if (process.argv.includes("--check")) {
    if (!current?.equals(encoded))
      throw new Error(`Fallback format is stale: ${path}`);
  } else if (!current?.equals(encoded)) writeFileSync(path, encoded);
}
