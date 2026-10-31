// Initial JS budget check (spec 7.5: <= 200 KB gzip before the 3D chunks).
// Reads the prerendered HTML of a route from `.next/server/app`, takes every script the HTML loads
// (`<script src>` and `<link rel="preload" as="script">`), gzips each chunk and prints the sizes.
// Modern browsers ignore nomodule scripts, so their legacy polyfills are excluded.
// Lazy chunks (the 3D scene, dialogs) are not in the HTML, so they are not counted.
//
//   node scripts/measure-initial-js.mjs            -> /en, /ja, /vi, /en/quick, /en/projects
//   node scripts/measure-initial-js.mjs en --json  -> one route, machine-readable
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 200;
const root = process.cwd();
const args = process.argv.slice(2);
const json = args.includes("--json");
const routes = args.filter((a) => !a.startsWith("--"));
const list = routes.length
  ? routes
  : ["en", "ja", "vi", "en/quick", "en/projects"];

function scriptsOf(html) {
  const found = new Set();
  for (const m of html.matchAll(/<script\b[^>]*>/gi)) {
    if (/\snomodule(?:\s|=|>)/i.test(m[0])) continue;
    const src = m[0].match(/\ssrc="([^"]+)"/i)?.[1];
    if (src) found.add(src);
  }
  for (const m of html.matchAll(
    /<link[^>]*rel="preload"[^>]*as="script"[^>]*href="([^"]+)"/g,
  ))
    found.add(m[1]);
  for (const m of html.matchAll(
    /<link[^>]*as="script"[^>]*rel="preload"[^>]*href="([^"]+)"/g,
  ))
    found.add(m[1]);
  return [...found].filter((s) => s.startsWith("/_next/static/"));
}

const results = [];
let failed = false;
for (const route of list) {
  const file = join(root, ".next/server/app", `${route}.html`);
  if (!existsSync(file)) {
    failed = true;
    if (!json)
      console.error(
        `/${route}: no production HTML; build this route before checking its budget`,
      );
    continue;
  }
  const html = readFileSync(file, "utf8");
  const chunks = scriptsOf(html).map((src) => {
    const assetPath = decodeURIComponent(src.replace(/^\/_next\//, ""));
    const buf = readFileSync(join(root, ".next", assetPath));
    return { src, raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
  });
  chunks.sort((a, b) => b.gzip - a.gzip);
  const total = chunks.reduce((s, c) => s + c.gzip, 0);
  results.push({
    route: `/${route}`,
    totalKB: +(total / 1024).toFixed(1),
    chunks,
  });
  if (total / 1024 > BUDGET_KB) failed = true;
  if (!json) {
    console.log(
      `\n/${route}: ${chunks.length} scripts, ${(total / 1024).toFixed(1)} KB gzip (budget ${BUDGET_KB} KB)`,
    );
    for (const c of chunks)
      console.log(
        `  ${(c.gzip / 1024).toFixed(1).padStart(6)} KB gz  ${(c.raw / 1024).toFixed(1).padStart(7)} KB raw  ${c.src}`,
      );
  }
}
if (json) console.log(JSON.stringify(results, null, 2));
process.exitCode = failed ? 1 : 0;
