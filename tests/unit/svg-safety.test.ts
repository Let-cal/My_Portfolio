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
    expect(isSafeSvg(wrap(`<g href="#a"/><g xlink:href='#b'/>`))).toEqual({
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
    ["an external href", wrap(`<g href="https://evil.test/x.png"/>`), /href/i],
    [
      "a javascript xlink:href",
      wrap(`<g xlink:href="javascript:alert(1)"><text>x</text></g>`),
      /href/i,
    ],
    [
      "an entity-encoded javascript href",
      wrap(`<g href="&#106;avascript:alert(1)"><text>x</text></g>`),
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
    [
      "a set element",
      wrap(`<set attributeName="href" to="x"/>`),
      /not allowed/i,
    ],
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

describe("isSafeSvg rejects namespace-prefixed elements and SMIL attributes", () => {
  const NS = `xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg"`;
  it.each([
    [
      "a prefixed script",
      `<svg ${NS}><s:script>alert(1)</s:script></svg>`,
      /prefix|namespace/i,
    ],
    [
      "an XHTML-prefixed script",
      `<svg xmlns="http://www.w3.org/2000/svg"><h:script xmlns:h="http://www.w3.org/1999/xhtml">alert(1)</h:script></svg>`,
      /prefix/i,
    ],
    [
      "a prefixed set that rewrites an href",
      `<svg ${NS}><a href="#a"><s:set attributeName="href" to="javascript:alert(1)"/><text>x</text></a></svg>`,
      /prefix|namespace|SMIL|animation/i,
    ],
    [
      "a prefixed foreignObject",
      `<svg ${NS}><s:foreignObject><div/></s:foreignObject></svg>`,
      /prefix|namespace/i,
    ],
    [
      "an XHTML-prefixed iframe",
      `<svg xmlns="http://www.w3.org/2000/svg"><h:iframe xmlns:h="http://www.w3.org/1999/xhtml" src="https://evil.test"/></svg>`,
      /prefix/i,
    ],
    [
      "a prefixed style element",
      `<svg ${NS}><s:style>.a{fill:red}</s:style></svg>`,
      /prefix|namespace/i,
    ],
    [
      "an attributeName attribute on any element",
      wrap(`<g attributeName="href" to="javascript:x"/>`),
      /SMIL|animation/i,
    ],
    [
      "SMIL to/values attributes",
      wrap(`<g values="javascript:x"/>`),
      /SMIL|animation/i,
    ],
  ])("%s", (_name, svg, reason) => {
    expect(reasonOf(svg)).toMatch(reason);
  });

  it.each([
    [
      "a CSS src() function",
      wrap(
        `<text>x</text>`,
        `<style>.a{background:src("https://evil.test/a")}</style>`,
      ),
      /CSS construct/,
    ],
    [
      "a CSS image() function in a style attribute",
      wrap(`<rect style="background:image('https://evil.test/a')"/>`),
      /CSS construct/,
    ],
    [
      "a DOCTYPE with an external id",
      `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://evil.test/a.dtd">` +
        wrap(`<text>x</text>`),
      /DOCTYPE/,
    ],
  ])("%s", (_name, svg, reason) => {
    expect(reasonOf(svg)).toMatch(reason);
  });

  it("a data font hidden between escaped style tags in attributes", () => {
    const svg = wrap(
      `<g data-x="&lt;style&gt;"/><rect style="fill:url(${FONT_URL})"/><g data-y="&lt;/style&gt;"/>`,
    );
    expect(reasonOf(svg)).toMatch(/url\(/);
  });

  it("accepts label text such as Image (PNG) and src (primary)", () => {
    expect(isSafeSvg(wrap(`<text>Image (PNG) src (primary)</text>`))).toEqual({
      ok: true,
    });
  });

  it("still accepts xlink:href and the xmlns:xlink declaration", () => {
    expect(
      isSafeSvg(
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g xlink:href="#a"><text>x</text></g></svg>`,
      ),
    ).toEqual({ ok: true });
  });
});

describe("isSafeSvg allowlist (round 2 payloads)", () => {
  const SVGNS = "http://www.w3.org/2000/svg";
  const XH = "http://www.w3.org/1999/xhtml";
  const W = (inner: string, head = "") =>
    `<svg xmlns="${SVGNS}" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">${head}${inner}</svg>`;

  it.each([
    [
      "non-ASCII prefix e-acute script",
      `<svg xmlns="${SVGNS}" xmlns:\u00e9="${SVGNS}"><\u00e9:script>fetch('https://evil.test/')</\u00e9:script></svg>`,
    ],
    [
      "middle-dot prefix script",
      `<svg xmlns="${SVGNS}" xmlns:a\u00b7b="${SVGNS}"><a\u00b7b:script>fetch('https://evil.test/')</a\u00b7b:script></svg>`,
    ],
    [
      "non-ASCII prefix bound to XHTML, iframe",
      `<svg xmlns="${SVGNS}" xmlns:\u00e9="${XH}"><\u00e9:iframe src="https://evil.test/"/></svg>`,
    ],
    [
      "XHTML default namespace img",
      `<svg xmlns="${SVGNS}"><g><img xmlns="${XH}" src="https://evil.test/"/></g></svg>`,
    ],
    [
      "XHTML default namespace input type=image",
      `<svg xmlns="${SVGNS}"><input xmlns="${XH}" type="image" src="https://evil.test/"/></svg>`,
    ],
    [
      "uppercase prefix",
      `<svg xmlns="${SVGNS}" xmlns:S="${SVGNS}"><S:script>x</S:script></svg>`,
    ],
    ["a space after the angle bracket", W(`< s:script>x</ s:script>`)],
    ["CDATA", W(`<text><![CDATA[&lt;s:script&gt;]]></text>`)],
    ["a comment", W(`<!-- hi --><text>x</text>`)],
    ["animateMotion", W(`<animateMotion path="M0 0" dur="1s"/>`)],
    ["animateTransform", W(`<animateTransform type="rotate" dur="1s"/>`)],
    ["a use element", W(`<use href="#a"/>`)],
    ["an image element", W(`<image href="#a"/>`)],
    ["an anchor element", W(`<a href="#a"><text>x</text></a>`)],
    [
      "a foreignObject with an XHTML child",
      W(`<foreignObject><div xmlns="${XH}">x</div></foreignObject>`),
    ],
    [
      "a padded javascript xlink:href",
      W(`<a xlink:href="  javascript:alert(1)"><text>x</text></a>`),
    ],
    ["SMIL begin", W(`<rect begin="click"/>`)],
    [
      "an attribute name split over lines",
      W(`<rect\nattributeName\n=\n"href"/>`),
    ],
    ["a padded SMIL values", W(`<g values=" javascript:alert(1)"/>`)],
    ["an unquoted attribute value", W(`<rect width=5/>`)],
    ["an attribute with a non-ASCII name", W(`<rect \u00e9="1"/>`)],
    ["xml:base", W(`<rect xml:base="https://evil.test/"/>`)],
    [
      "an xmlns:* declaration",
      `<svg xmlns="${SVGNS}" xmlns:s="${SVGNS}"><text>x</text></svg>`,
    ],
    [
      "an xmlns bound to another namespace",
      `<svg xmlns="${XH}"><text>x</text></svg>`,
    ],
    ["a non-svg root", `<g xmlns="${SVGNS}"><text>x</text></g>`],
    ["two roots", W(`<text>x</text>`) + W(`<text>y</text>`)],
    ["mismatched tags", W(`<g><text>x</g></text>`)],
    ["a stray angle bracket", W(`<text>a < b</text>`)],
    ["text before the root", `hello` + W(`<text>x</text>`)],
    [
      "image-set after a hidden </style> in a comment",
      W(
        `<rect width="100" height="100"/>`,
        `<style>a{}<!--</style>-->svg{background-image:image-set("https://evil.test/" 1x)}</style>`,
      ),
    ],
    [
      "image-set after a hidden </style> in CDATA",
      W(
        `<rect/>`,
        `<style><![CDATA[</style>]]>{} svg{background-image:image-set("https://evil.test/" 1x)}</style>`,
      ),
    ],
    [
      "image-set in a plain style",
      W(
        `<rect/>`,
        `<style>svg{background-image:image-set("https://evil.test/" 1x)}</style>`,
      ),
    ],
    [
      "a CSS function in a presentation attribute",
      W(`<rect style="mask-image:image-set('https://evil.test/' 1x)"/>`),
    ],
    [
      "a style element holding markup",
      W(`<text>x</text>`, `<style><g/></style>`),
    ],
  ])("rejects %s", (_name, svg) => {
    const r = isSafeSvg(svg);
    expect(r.ok).toBe(false);
  });

  it.each([
    [
      "label text with to = and values =",
      W(`<text>map key to = value, values = abc</text>`),
    ],
    [
      "label text with a prefix-like pair",
      W(`<text>List&lt;T:Item&gt;</text>`),
    ],
    [
      "label text mentioning image (PNG) and src (x)",
      W(`<text>Image (PNG) src (x)</text>`),
    ],
    [
      "a drop-shadow filter and a symbol",
      W(
        `<symbol id="s"><rect width="1" height="1"/></symbol><rect filter="url(#f)" width="1" height="1"/>`,
        `<defs><filter id="f"><feDropShadow dx="1" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/></filter></defs>`,
      ),
    ],
    [
      "a prolog before the root",
      `<?xml version="1.0" encoding="UTF-8"?>\n` + W(`<text>x</text>`),
    ],
  ])("accepts %s", (_name, svg) => {
    expect(isSafeSvg(svg)).toEqual({ ok: true });
  });
});
