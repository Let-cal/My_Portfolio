import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SKILL_ICON_IDS, skillIconFor } from "../src/components/sections/skills/skill-icons";

// Simple Icons glyphs are CC0. External symbols keep their exact currentColor artwork
// while avoiding duplicate path payloads in the document and React server stream.
const symbols = SKILL_ICON_IDS.map(id => `<symbol id="skill-icon-${id}" viewBox="0 0 24 24"><path d="${skillIconFor(id)!.path}"/></symbol>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${symbols}</defs></svg>\n`;
const path = "public/images/skill-sprite.svg";
if (process.argv.includes("--check")) {
  if (!existsSync(path) || readFileSync(path, "utf8") !== svg) throw new Error("Skill sprite is stale");
} else if (!existsSync(path) || readFileSync(path, "utf8") !== svg) writeFileSync(path, svg);
