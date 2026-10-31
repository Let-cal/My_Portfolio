// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isSafeSvg, sanitizeSvg } from "@/lib/figures/svg-safety";

const FONT_STYLE =
  `<style>@font-face{font-family:"Space Grotesk";font-weight:300 700;` +
  `src:url(data:font/woff2;base64,d09GMgABAAAAAA==) format("woff2")}</style>`;

const MERMAID_LIKE =
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
  `width="200" height="80" viewBox="0 0 200 80">${FONT_STYLE}` +
  `<style>#d .node > rect{fill:#141416;stroke:#2c2c2d}</style>` +
  `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">` +
  `<path d="M0 0L10 5L0 10z" fill="rgba(249, 115, 22, 0.7)"/></marker></defs>` +
  `<g class="node"><rect x="10" y="10" width="80" height="40"/><text x="20" y="35">A&#160;B</text></g>` +
  `<path d="M90 30L150 30" marker-end="url(#arrow)" stroke="rgba(249, 115, 22, 0.7)"/>` +
  `<a xlink:href="#arrow"><text x="5" y="70">link</text></a></svg>`;

describe("sanitizeSvg (jsdom)", () => {
  it("keeps a Mermaid-like SVG with its embedded font and fragment references", () => {
    const out = sanitizeSvg(MERMAID_LIKE);
    expect(isSafeSvg(out)).toEqual({ ok: true });
    expect(out).toContain("data:font/woff2;base64,d09GMgABAAAAAA==");
    expect(out).toContain('marker-end="url(#arrow)"');
    expect(out).toContain('viewBox="0 0 200 80"');
    expect(out).toContain('id="arrow"');
    expect(out).toContain('xlink:href="#arrow"');
    expect(out).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    // A no-break space must not leave an entity that standalone XML cannot read.
    expect(out).not.toContain("&nbsp;");
    // Valid XML: it parses without an error document.
    const doc = new DOMParser().parseFromString(out, "image/svg+xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("strips scripts, event handlers and foreignObject", () => {
    const out = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">` +
        `<script>alert(1)</script><rect onload="x()" width="5" height="5"/>` +
        `<foreignObject><div>hi</div></foreignObject></svg>`,
    );
    expect(out).not.toMatch(/script|onload|foreignobject|<div/i);
    expect(out).toContain("<rect");
  });

  it("strips external and javascript hrefs", () => {
    const out = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">` +
        `<a xlink:href="javascript:alert(1)"><text>x</text></a>` +
        `<image href="https://evil.test/x.png"/></svg>`,
    );
    expect(out).not.toMatch(/javascript:|evil\.test/i);
    expect(out).toContain("<text>x</text>");
  });

  it("strips SMIL animation that could set an href", () => {
    const out = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">` +
        `<a href="#a"><set attributeName="href" to="javascript:x"/><text>x</text></a></svg>`,
    );
    expect(out).not.toMatch(/<set|javascript:/i);
  });

  it("throws when hostile CSS survives the DOM pass", () => {
    expect(() =>
      sanitizeSvg(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">` +
          `<style>.a{background:url(https://evil.test/a)}</style><text>x</text></svg>`,
      ),
    ).toThrow(/Unsafe SVG/);
  });
});
