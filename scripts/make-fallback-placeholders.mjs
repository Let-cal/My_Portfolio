// Writes the four placeholder backdrops in public/fallback (koi/dragon x night/day) so <KoiCanvas /> never 404s.
// Task 18 replaces them with captures of the real scene. Run: node scripts/make-fallback-placeholders.mjs
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const W = 1280;
const H = 720;
const out = new URL("../public/fallback/", import.meta.url);

const themes = {
  night: { top: "#050b16", bottom: "#0c2a44", glow: "#1d6fa5", koi: "#f97316", dragon: "#e0a84e", opacity: 0.55 },
  day: { top: "#cfeaf2", bottom: "#7cc4d8", glow: "#ffffff", koi: "#ea580c", dragon: "#b7791f", opacity: 0.7 },
};

const koiShape = (c) => `
  <g transform="translate(640 380) rotate(-12)" fill="${c.koi}" fill-opacity="${c.opacity}">
    <path d="M-220 0 C-120 -70 90 -70 190 -6 C100 60 -120 70 -220 0 Z"/>
    <path d="M190 -6 L300 -60 C280 -10 280 20 300 70 Z"/>
    <path d="M-40 -48 L10 -118 L50 -52 Z" fill-opacity="${c.opacity * 0.7}"/>
  </g>`;

const dragonShape = (c) => `
  <g fill="none" stroke="${c.dragon}" stroke-opacity="${c.opacity}" stroke-linecap="round">
    <path d="M140 520 C300 300 420 640 580 420 S820 200 930 330 S1060 330 1130 250" stroke-width="46"/>
    <path d="M1130 250 l60 -40 l-10 54 z" fill="${c.dragon}" fill-opacity="${c.opacity}" stroke-width="6"/>
  </g>`;

for (const [name, c] of Object.entries(themes)) {
  for (const [kind, shape] of [["koi", koiShape], ["dragon", dragonShape]]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="1" stop-color="${c.bottom}"/></linearGradient>
        <radialGradient id="r" cx="70%" cy="30%" r="60%"><stop offset="0" stop-color="${c.glow}" stop-opacity=".35"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>
        <filter id="b"><feGaussianBlur stdDeviation="14"/></filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/>
      <g filter="url(#b)">${shape(c)}</g>
    </svg>`;
    await mkdir(out, { recursive: true });
    await sharp(Buffer.from(svg)).jpeg({ quality: 55, mozjpeg: true }).toFile(fileURLToPath(new URL(`${kind}-${name}.jpg`, out)));
  }
}
console.log("done");
