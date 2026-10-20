import {
  siCypress,
  siDart,
  siDocker,
  siDotnet,
  siFastapi,
  siFigma,
  siFlutter,
  siFramer,
  siGithub,
  siGithubactions,
  siGitlab,
  siGsap,
  siJavascript,
  siJest,
  siJira,
  siLaravel,
  siModelcontextprotocol,
  siMongodb,
  siMui,
  siMysql,
  siNextdotjs,
  siNodedotjs,
  siOllama,
  siPhp,
  siPostgresql,
  siPython,
  siReact,
  siRedmine,
  siSass,
  siShadcnui,
  siTailwindcss,
  siTerraform,
  siTestinglibrary,
  siTypescript,
  siVllm,
} from "simple-icons";

/** A brand glyph (24x24 path, CC0 from simple-icons) and the colours it takes once a chip is hovered or selected. */
export type SkillIcon = {
  path: string;
  /** Brand colour for the light theme. */
  hex: string;
  /** Brand colour for the dark theme: the brand colour itself, or a light neutral when it would vanish on near-black. */
  hexDark: string;
};

type Source = { path: string; hex: string };

const SOURCES: Record<string, Source> = {
  typescript: siTypescript,
  javascript: siJavascript,
  python: siPython,
  php: siPhp,
  dart: siDart,
  nextjs: siNextdotjs,
  react: siReact,
  nodejs: siNodedotjs,
  "aspnet-core": siDotnet,
  fastapi: siFastapi,
  flutter: siFlutter,
  laravel: siLaravel,
  "tailwind-css": siTailwindcss,
  "shadcn-ui": siShadcnui,
  "framer-motion": siFramer,
  gsap: siGsap,
  sass: siSass,
  mui: siMui,
  terraform: siTerraform,
  docker: siDocker,
  gitlab: siGitlab,
  github: siGithub,
  mcp: siModelcontextprotocol,
  ollama: siOllama,
  vllm: siVllm,
  postgresql: siPostgresql,
  mysql: siMysql,
  mongodb: siMongodb,
  redmine: siRedmine,
  jira: siJira,
  jest: siJest,
  "react-testing-library": siTestinglibrary,
  cypress: siCypress,
  "github-actions": siGithubactions,
  figma: siFigma,
};

/** Relative luminance (0 black, 1 white) of a bare `RRGGBB` hex. */
function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Near-black brand colours (Next.js, GitHub, Ollama...) would disappear on the dark theme, so they lift to a light neutral there. */
const DARK_FALLBACK = "#e7e5e4";
const LUMINANCE_FLOOR = 0.06;

const ICONS: Record<string, SkillIcon> = Object.fromEntries(
  Object.entries(SOURCES).map(([id, { path, hex }]) => [
    id,
    {
      path,
      hex: `#${hex}`,
      hexDark: luminance(hex) < LUMINANCE_FLOOR ? DARK_FALLBACK : `#${hex}`,
    },
  ]),
);

export const SKILL_ICON_IDS = Object.keys(ICONS);

/** Brand glyph of a skill, or null when simple-icons has none (AWS services, Oracle, SQL Server and some others are not in the set). */
export function skillIconFor(skillId: string): SkillIcon | null {
  return ICONS[skillId] ?? null;
}

/** Up to two letters for the tile of a skill without a glyph: "Amazon RDS" -> AR, "Oracle" -> OR. */
export function monogramOf(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const letters =
    words.length > 1
      ? words
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
      : (words[0] ?? name).slice(0, 2);
  return letters.toUpperCase();
}
