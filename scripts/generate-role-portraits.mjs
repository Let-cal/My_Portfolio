// Usage: node scripts/generate-role-portraits.mjs <path-to-source-photo.png> public/images/roles
// Then: convert PNGs to WebP (quality 82). Keep the source photo outside public/ and version control.
// Spike: generate 3 stylised role portraits from the source photo (offline, procedural).
import { createRequire } from 'node:module';
import Delaunator from 'delaunator';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const SRC = process.argv[2] ?? 'source.png';
const OUT = process.argv[3] ?? '.';
const S = 4; // output scale

// deterministic rng
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const px = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
const lum = (x, y) => { const [r, g, b] = px(x, y); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

// ---- background mask: flood fill near-white from the border ----
const bg = new Uint8Array(W * H);
const isBgColor = (x, y) => { const [r, g, b] = px(x, y); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mn > 222 && mx - mn < 22; };
const stack = [];
for (let x = 0; x < W; x++) { stack.push([x, 0]); }
for (let y = 0; y < H * 0.6; y++) { stack.push([0, y], [W - 1, y]); }
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const k = y * W + x; if (bg[k] || !isBgColor(x, y)) continue;
  bg[k] = 1; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}
const inside = (x, y) => { if (x > W - 4 || x < 3) return false; x = Math.max(0, Math.min(W - 1, Math.round(x))); y = Math.max(0, Math.min(H - 1, Math.round(y))); return !bg[y * W + x]; };
// histogram equalisation of luminance inside the subject mask
const hist = new Array(256).fill(0); let cnt = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (bg[y * W + x]) continue; hist[Math.round(lum(x, y) * 255)]++; cnt++; }
const cdf = []; { let acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; cdf[i] = acc / cnt; } }
const rawLumAt = (x, y) => lum(Math.max(0, Math.min(W - 1, Math.round(x))), Math.max(0, Math.min(H - 1, Math.round(y))));
const lumAt = (x, y) => { const l = rawLumAt(x, y); return 0.3 * l + 0.7 * cdf[Math.round(l * 255)]; };

// Sobel magnitude
function edge(x, y) {
  const L = (a, b) => lumAt(x + a, y + b);
  const gx = -L(-1, -1) - 2 * L(-1, 0) - L(-1, 1) + L(1, -1) + 2 * L(1, 0) + L(1, 1);
  const gy = -L(-1, -1) - 2 * L(0, -1) - L(1, -1) + L(-1, 1) + 2 * L(0, 1) + L(1, 1);
  return { m: Math.hypot(gx, gy), a: Math.atan2(gy, gx) };
}

const OW = W * S, OH = H * S;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ================= 1. DEVELOPER: face made of code =================
{
  const code = `const koi = await agent.run({ tools, tenant }); export async function handler(event) { const order = await db.get({ TableName: "lockers", Key: { id } }); if (!order) throw new NotFound(); await iot.publish(topic, { door: order.door, action: "open" }); return json(200, order); } interface Role { key: "fullstack" | "techlead" | "pm"; } app.post("/api/v1/coa/approve", requireRole("approver"), async (req, res) => { await pdf.render(template, data); }); SELECT tenant_id, COUNT(*) FROM usage GROUP BY tenant_id; terraform apply -auto-approve; docker compose up -d; `;
  const cell = 1.3; // source px per glyph
  const cols = Math.floor(W / cell), rows = Math.floor(H / (cell * 1.18));
  let i = 0, out = '';
  for (let r = 0; r < rows; r++) {
    const y = r * cell * 1.18 + cell;
    let line = '';
    for (let c = 0; c < cols; c++) {
      const x = c * cell + cell / 2;
      if (!inside(x, y)) { continue; }
      const l = lumAt(x, y);
      const em = Math.min(1, edge(x, y).m * 1.8);
      const o = Math.max(0.06, Math.min(1, Math.pow(l, 1.7) * 0.95 + em * 0.3));
      const ch = code[i++ % code.length];
      const hue = 170 + (1 - l) * 40; // teal -> cyan/blue for shadows
      line += `<tspan x="${(x * S).toFixed(1)}" fill="hsl(${hue.toFixed(0)} 90% ${(28 + l * 48 + em * 18).toFixed(0)}%)" fill-opacity="${o.toFixed(2)}">${esc(ch)}</tspan>`;
    }
    if (line) out += `<text y="${(y * S).toFixed(1)}" font-family="Consolas, 'Courier New', monospace" font-size="${(cell * S * 1.32).toFixed(1)}" font-weight="700">${line}</text>`;
  }
  // text layer: every glyph fully opaque, then modulated per-pixel by a contrast-boosted luminance map
  const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}">${out.replace(/fill-opacity="[^"]*"/g, '')}</svg>`;
  const { data: textRaw, info: tinfo } = await sharp(Buffer.from(textSvg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); console.log("text", tinfo.width, tinfo.height, tinfo.channels, "out", OW, OH);
  const lmap = Buffer.alloc(W * H);
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lmap[y * W + x] = inside(x, y) ? Math.round(255 * smooth(Math.min(1, Math.max(0, (lumAt(x, y) - 0.12) / 0.8)))) : 0;
  const lmapBig = await sharp(lmap, { raw: { width: W, height: H, channels: 1 } }).resize(OW, OH).blur(1.2).extractChannel(0).raw().toBuffer();

  const outRaw = Buffer.alloc(OW * OH * 3);
  for (let p = 0; p < OW * OH; p++) {
    const yy = Math.floor(p / OW), xx = p % OW;
    const dx = (xx / OW - 0.5), dy = (yy / OH - 0.38); const glow = Math.max(0, 1 - Math.hypot(dx, dy) * 1.4) * 0.12;
    const bgc = [6 + 8 * glow, 17 + 100 * glow, 26 + 120 * glow];
    const a = textRaw[p * 4 + 3] / 255; const m = lmapBig[p] / 255; const k = a * Math.max(0.13, Math.pow(m, 1.5));
    for (let c = 0; c < 3; c++) outRaw[p * 3 + c] = Math.min(255, Math.round(bgc[c] * (1 - k) + textRaw[p * 4 + c] * Math.min(1, k * 1.25) * 1.2));
  }
  await sharp(outRaw, { raw: { width: OW, height: OH, channels: 3 } }).png().toFile(`${OUT}/role-developer.png`);
}

// ================= 2. TECH LEAD: low-poly architecture wireframe =================
{
  const r = rng(7); const pts = [];
  // edge-weighted sampling
  for (let n = 0; n < 9000 && pts.length < 1400; n++) {
    const x = r() * W, y = r() * H; if (!inside(x, y)) continue;
    const e = edge(x, y).m; if (r() < 0.06 + Math.min(1, e * 1.6)) pts.push([x, y]);
  }
  // add contour-ish border points
  for (let y = 0; y < H; y += 3) for (let x = 1; x < W - 1; x += 1) { if (inside(x, y) && !inside(x - 1, y)) { pts.push([x, y]); break; } }
  for (let y = 0; y < H; y += 3) for (let x = W - 2; x > 0; x -= 1) { if (inside(x, y) && !inside(x + 1, y)) { pts.push([x, y]); break; } }
  const d = Delaunator.from(pts);
  let tris = '', lines = '', nodes = '';
  for (let t = 0; t < d.triangles.length; t += 3) {
    const a = pts[d.triangles[t]], b = pts[d.triangles[t + 1]], c = pts[d.triangles[t + 2]];
    const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
    if (!inside(cx, cy)) continue;
    const l = lumAt(cx, cy);
    const light = 8 + Math.pow(l, 1.1) * 62;
    const P = (p) => `${(p[0] * S).toFixed(1)},${(p[1] * S).toFixed(1)}`;
    tris += `<polygon points="${P(a)} ${P(b)} ${P(c)}" fill="hsl(${(205 - l * 15).toFixed(0)} 70% ${light.toFixed(0)}%)" stroke="#7dd3fc" stroke-opacity="${(0.12 + (1 - l) * 0.25).toFixed(2)}" stroke-width="1"/>`;
  }
  // a few "architecture" nodes on strong features
  const rr = rng(3);
  for (let k = 0; k < 14; k++) { const p = pts[Math.floor(rr() * pts.length)]; nodes += `<circle cx="${p[0] * S}" cy="${p[1] * S}" r="5" fill="#0b1220" stroke="#38bdf8" stroke-width="2"/>`; if (k) { const q = pts[Math.floor(rr() * pts.length)]; lines += `<path d="M${p[0] * S} ${p[1] * S} H${q[0] * S} V${q[1] * S}" stroke="#38bdf8" stroke-opacity=".35" stroke-width="1.5" fill="none" stroke-dasharray="6 6"/>`; } }
  const grid = `<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#1e3a5f" stroke-width="1"/></pattern><pattern id="grid2" width="120" height="120" patternUnits="userSpaceOnUse"><path d="M120 0H0V120" fill="none" stroke="#2b5c8a" stroke-width="1.5"/></pattern>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}"><defs>${grid}</defs><rect width="100%" height="100%" fill="#0a1a2e"/><rect width="100%" height="100%" fill="url(#grid)"/><rect width="100%" height="100%" fill="url(#grid2)"/>${tris}${lines}${nodes}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/role-techlead.png`);
}

// ================= 3. PM: painterly brush strokes (Ogon gold) + planning motifs =================
{
  const r = rng(11); let strokes = '';
  const pal = (l) => { // dark navy -> amber -> gold -> cream
    const stops = [[0, [24, 22, 40]], [0.35, [122, 52, 20]], [0.6, [224, 168, 78]], [0.85, [250, 214, 150]], [1, [255, 246, 228]]];
    for (let i = 1; i < stops.length; i++) if (l <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const t = (l - a) / (b - a); return ca.map((v, k) => Math.round(v + (cb[k] - v) * t)); }
    return stops.at(-1)[1];
  };
  for (const pass of [{ n: 2600, len: 9, w: 4.2 }, { n: 5200, len: 5, w: 2.2 }, { n: 4200, len: 3, w: 1.2 }]) {
    for (let k = 0; k < pass.n; k++) {
      const x = r() * W, y = r() * H; if (!inside(x, y)) continue;
      const e = edge(x, y); if (pass.w < 2 && e.m < 0.25) continue; // detail strokes only on edges
      const ang = e.a + Math.PI / 2 + (r() - 0.5) * 0.5;
      const L = pass.len * (0.6 + r() * 0.8);
      const c = pal(Math.min(1, Math.max(0, lumAt(x, y) + (r() - 0.5) * 0.08)));
      const x1 = (x - Math.cos(ang) * L / 2) * S, y1 = (y - Math.sin(ang) * L / 2) * S, x2 = (x + Math.cos(ang) * L / 2) * S, y2 = (y + Math.sin(ang) * L / 2) * S;
      strokes += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgb(${c})" stroke-width="${(pass.w * S * (0.7 + r() * 0.5)).toFixed(1)}" stroke-linecap="round" stroke-opacity="0.9"/>`;
    }
  }
  // planning motifs: subtle gantt bars + check marks in the background
  let motif = '';
  const bars = [[0.06, 0.10, 0.30], [0.12, 0.16, 0.42], [0.62, 0.20, 0.30], [0.70, 0.27, 0.22], [0.05, 0.86, 0.34], [0.60, 0.92, 0.35]];
  for (const [bx, by, bw] of bars) motif += `<rect x="${bx * OW}" y="${by * OH}" width="${bw * OW}" height="${OH * 0.022}" rx="${OH * 0.011}" fill="#e0a84e" fill-opacity=".18"/>`;
  // underpainting: palette-mapped, blurred, so strokes never leave holes
  const under = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4;
    if (!inside(x, y)) { under[k] = 20; under[k + 1] = 18; under[k + 2] = 28; under[k + 3] = 255; continue; }
    const c = pal(lumAt(x, y)); under[k] = c[0]; under[k + 1] = c[1]; under[k + 2] = c[2]; under[k + 3] = 255;
  }
  const underPng = await sharp(under, { raw: { width: W, height: H, channels: 4 } }).resize(OW, OH).blur(5).png().toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}">${motif}<g>${strokes}</g></svg>`;
  await sharp(underPng).composite([{ input: Buffer.from(svg) }]).png().toFile(`${OUT}/role-pm.png`);
}
console.log('done', W, H);
