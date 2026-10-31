import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSafeSvg, SVG_MAX_BYTES } from "@/lib/figures/svg-safety";

const wrap = (inner: string, head = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">${head}${inner}</svg>`;

const FONT_URL = "data:font/woff2;base64,d09GMgABAAAAAA==";

function reasonOf(svg: string): string {
  const r = isSafeSvg(svg);
  if (r.ok) throw new Error("expected the SVG to be rejected");
  return r.reason;
}

describe("isSafeSvg accepts", () => {
  it("a plain Mermaid-like SVG", () => {
    const svg = wrap(
      `<g class="node"><rect width="40" height="20" fill="#141416"/><text x="5" y="12">API</text></g>` +
        `<path d="M0 0L10 10" marker-end="url(#arrow)" stroke="rgba(249, 115, 22, 0.7)"/>`,
      `<style>#m{font-family:Space Grotesk;fill:#f4f4f5}.a>.b{stroke:url(#grad)}</style>` +
        `<defs><marker id="arrow"><path d="M0 0L5 2.5L0 5z"/></marker></defs>`,
    );
    expect(isSafeSvg(svg)).toEqual({ ok: true });
  });

  it("fragment references through href and xlink:href", () => {
    expect(isSafeSvg(wrap(`<use href="#a"/><use xlink:href='#b'/>`))).toEqual({
      ok: true,
    });
  });

  it("an embedded data:font/woff2 font inside the SVG's own style", () => {
    const style = `<style>@font-face{font-family:"Space Grotesk";src:url(${FONT_URL}) format("woff2");font-weight:300 700}</style>`;
    expect(isSafeSvg(wrap(`<text>Hi</text>`, style))).toEqual({ ok: true });
  });

  it("every committed seed figure", () => {
    const dir = join(process.cwd(), "public", "seed", "figures");
    const files = readdirSync(dir).filter((f) => f.endsWith(".svg"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const result = isSafeSvg(readFileSync(join(dir, file), "utf8"));
      expect({ file, result }).toEqual({ file, result: { ok: true } });
    }
  });

  it("label text that contains the letters on or script", () => {
    expect(
      isSafeSvg(wrap(`<text>Session on = start, scripts run</text>`)),
    ).toEqual({ ok: true });
  });
});

describe("isSafeSvg rejects", () => {
  it.each([
    ["a script element", wrap(`<script>alert(1)</script>`), /script/i],
    ["an uppercase script element", wrap(`<SCRIPT >x</SCRIPT>`), /script/i],
    ["an event attribute", wrap(`<rect onload="x()"/>`), /event/i],
    [
      "an event attribute in single quotes",
      wrap(`<g onclick='x()'></g>`),
      /event/i,
    ],
    [
      "a foreignObject",
      wrap(`<foreignObject><div/></foreignObject>`),
      /foreignObject/i,
    ],
    [
      "an external href",
      wrap(`<image href="https://evil.test/x.png"/>`),
      /href/i,
    ],
    [
      "a javascript xlink:href",
      wrap(`<a xlink:href="javascript:alert(1)"><text>x</text></a>`),
      /href/i,
    ],
    [
      "an entity-encoded javascript href",
      wrap(`<a href="&#106;avascript:alert(1)"><text>x</text></a>`),
      /href/i,
    ],
    [
      "an external url()",
      wrap(`<rect style="fill:url(https://evil.test/a)"/>`),
      /url\(/i,
    ],
    [
      "an external url() in a style element",
      wrap(
        `<text>x</text>`,
        `<style>.a{background:url("//evil.test/a")}</style>`,
      ),
      /url\(/i,
    ],
    [
      "a css-escaped url()",
      wrap(
        `<text>x</text>`,
        `<style>.a{background:\\75 rl(https://evil.test/a)}</style>`,
      ),
      /url\(/i,
    ],
    [
      "an entity-encoded url()",
      wrap(`<rect style="fill:u&#114;l(https://evil.test/a)"/>`),
      /url\(/i,
    ],
    [
      "a css @import",
      wrap(
        `<text>x</text>`,
        `<style>@import "https://evil.test/a.css";</style>`,
      ),
      /import/i,
    ],
    [
      "a data font outside a style element",
      wrap(`<rect style="fill:url(${FONT_URL})"/>`),
      /url\(/i,
    ],
    [
      "a non-font data url",
      wrap(
        `<text>x</text>`,
        `<style>.a{background:url(data:image/png;base64,AAAA)}</style>`,
      ),
      /url\(/i,
    ],
    [
      "an ENTITY declaration",
      `<!DOCTYPE svg [<!ENTITY x "y">]>` + wrap(`<text>&x;</text>`),
      /entity/i,
    ],
    [
      "an animate element",
      wrap(`<animate attributeName="href" to="javascript:x"/>`),
      /animat/i,
    ],
    ["a set element", wrap(`<set attributeName="href" to="x"/>`), /animat/i],
    ["markup that is not an SVG", `<html><body>hi</body></html>`, /svg/i],
  ])("%s", (_name, svg, reason) => {
    expect(reasonOf(svg)).toMatch(reason);
  });

  it("an SVG over 1 MB", () => {
    expect(SVG_MAX_BYTES).toBe(1024 * 1024);
    const big = wrap(`<text>${"a".repeat(SVG_MAX_BYTES)}</text>`);
    expect(reasonOf(big)).toMatch(/1 MB/);
  });

  it("an SVG over 1 MB measured in bytes, not characters", () => {
    const big = wrap(`<text>${"é".repeat(SVG_MAX_BYTES / 2)}</text>`);
    expect(reasonOf(big)).toMatch(/1 MB/);
  });
});
