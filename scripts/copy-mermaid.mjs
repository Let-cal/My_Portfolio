// Copies Mermaid's self-contained build into public/vendor (gitignored) so the admin
// diagram editor can load it with a plain dynamic import of a URL. Mermaid then stays
// out of the webpack graph: no lazy chunk of it is listed in the shared runtime that
// every public page loads. Runs before `next build` and `next dev`.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("mermaid/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const source = join(dirname(pkgPath), "dist", "mermaid.min.js");
const target = join(process.cwd(), "public", "vendor", "mermaid.min.js");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`mermaid ${version} -> public/vendor/mermaid.min.js`);
