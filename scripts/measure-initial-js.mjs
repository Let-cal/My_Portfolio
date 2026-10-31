// Initial JS budget check (spec 7.5: <= 200 KB gzip before the 3D chunks).
// Reads the prerendered HTML of a route from `.next/server/app`, takes every script the HTML loads
// (`<script src>` and `<link rel="preload" as="script">`), gzips each chunk and prints the sizes.
// Modern browsers ignore nomodule scripts, so their legacy polyfills are excluded.
// Lazy chunks (the 3D scene, dialogs) are not in the HTML, so they are not counted.
// The default run also caps the two lazy case-study figure chunks (figures view and viewer) at 25 KB gzip
// each, found through `.next/react-loadable-manifest.json` (spec 2026-10-31 section 10).
//
//   node scripts/measure-initial-js.mjs            -> /en, /ja, /vi, /en/quick, /en/projects + figure chunks
//   node scripts/measure-initial-js.mjs en --json  -> one route, machine-readable
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 200;
const FIGURE_BUDGET_KB = 25;

// Loadable-manifest keys are "<importing module> -> <import specifier>", with OS path separators.
const FIGURE_CHUNKS = [
  { label: "figures", key: /LazyFigureScroll\.tsx -> \.\/FigureScroll$/ },
  { label: "figure viewer", key: /LazyFigureViewer\.tsx -> \.\/FigureViewer$/ },
];

function gzipSize(buf) {
  return gzipSync(buf, { level: 9 }).length;
}

/**
 * Gzip size of the JS each lazy figure import loads, as listed in the build's loadable manifest (CSS is not
 * counted). A missing manifest or entry is a failure, so a rename cannot turn the check off.
 */
export function measureFigureChunks(root = process.cwd()) {
  const manifestPath = join(root, ".next/react-loadable-manifest.json");
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : null;
  return FIGURE_CHUNKS.map(({ label, key }) => {
    const base = { label, budgetKB: FIGURE_BUDGET_KB, files: [], gzip: 0 };
    if (!manifest)
      return { ...base, ok: false, error: `${label}: no ${manifestPath}` };
    const entry = Object.entries(manifest).find(([k]) =>
      key.test(k.replaceAll("\\", "/")),
    )?.[1];
    if (!entry)
      return {
        ...base,
        ok: false,
        error: `${label}: no loadable-manifest entry matching ${key}`,
      };
    const files = entry.files.filter((f) => f.endsWith(".js"));
    const gzip = files.reduce(
      (sum, f) => sum + gzipSize(readFileSync(join(root, ".next", f))),
      0,
    );
    const ok = files.length > 0 && gzip / 1024 <= FIGURE_BUDGET_KB;
    return {
      ...base,
      files,
      gzip,
      ok,
      error: ok
        ? undefined
        : `${label}: ${files.join(", ") || "no JS files"} is ${(gzip / 1024).toFixed(1)} KB gzip, over ${FIGURE_BUDGET_KB} KB`,
    };
  });
}

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

function main() {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const routes = args.filter((a) => !a.startsWith("--"));
  const list = routes.length
    ? routes
    : ["en", "ja", "vi", "en/quick", "en/projects"];

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
      return { src, raw: buf.length, gzip: gzipSize(buf) };
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

  // Figure chunks are checked on the default run only; a single-route run keeps its JSON shape.
  if (!routes.length) {
    if (!json) console.log("");
    for (const r of measureFigureChunks(root)) {
      if (!json)
        console.log(
          `${r.label}: ${(r.gzip / 1024).toFixed(1)} KB gzip (budget ${r.budgetKB} KB)`,
        );
      if (!r.ok) {
        failed = true;
        console.error(r.error);
      }
    }
  }
  if (json) console.log(JSON.stringify(results, null, 2));
  process.exitCode = failed ? 1 : 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
