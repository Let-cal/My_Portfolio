import { describe, expect, it } from "vitest";
import { isSafeSvg } from "@/lib/figures/svg-safety";

// Payloads from the third review round: encoding declarations that move the markup
// boundaries, control characters, and CSS escapes split by a line break.
const SVGNS = "http://www.w3.org/2000/svg";
const W = (inner: string, head = "") =>
  `<svg xmlns="${SVGNS}" viewBox="0 0 100 100">${head}${inner}</svg>`;

describe("isSafeSvg encoding declarations and control characters", () => {
  it.each([
    [
      "an ISO-2022-JP declaration hiding an event handler behind ESC $ B",
      `<?xml version="1.0" encoding="ISO-2022-JP"?><svg xmlns="${SVGNS}" a="\x1b$B">\x1b(B" onload="fetch('https://evil.test/')"><rect width="1" height="1"/></svg>`,
    ],
    [
      "a Shift_JIS encoding declaration",
      `<?xml version="1.0" encoding="Shift_JIS"?>` + W(`<rect/>`),
    ],
    [
      "a UTF-16 encoding declaration",
      `<?xml version="1.0" encoding="UTF-16"?>` + W(`<rect/>`),
    ],
    ["an ESC control character in text", W(`<text>a\x1bb</text>`)],
    ["a NUL character", W(`<text>a\x00b</text>`)],
    ["a control character in an attribute value", W(`<rect id="a\x08b"/>`)],
    ["a vertical tab", W(`<text>a\x0bb</text>`)],
  ])("rejects %s", (_name, svg) => {
    expect(isSafeSvg(svg).ok).toBe(false);
  });

  it("accepts an XML declaration with UTF-8 (any case) or no encoding", () => {
    for (const decl of [
      `<?xml version="1.0"?>`,
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<?xml version='1.0' encoding='utf-8' standalone='no'?>`,
    ]) {
      expect(isSafeSvg(decl + "\n" + W(`<text>x</text>`))).toEqual({
        ok: true,
      });
    }
  });

  it("rejects a repeated attribute (XML parsers refuse it, HTML parsers do not)", () => {
    expect(isSafeSvg(W(`<rect id="a" id="b"/>`)).ok).toBe(false);
  });

  it("accepts tab, newline and carriage return in markup", () => {
    expect(isSafeSvg(W(`<g>\r\n\t<text>x</text>\r\n</g>`))).toEqual({
      ok: true,
    });
  });
});

describe("isSafeSvg CSS escapes split by a line break", () => {
  it.each([
    [
      "url() in a style element (raw CRLF)",
      W(
        `<rect/>`,
        `<style>a{background:\\75\r\nrl(https://evil.test/a)}</style>`,
      ),
    ],
    [
      "url() in a style element (entity CRLF)",
      W(
        `<rect/>`,
        `<style>a{background:\\75&#13;&#10;rl(https://evil.test/a)}</style>`,
      ),
    ],
    [
      "@import (raw CRLF)",
      W(`<rect/>`, `<style>@\\69\r\nmport "https://evil.test/a.css";</style>`),
    ],
    [
      "url() in a style attribute (entity CRLF)",
      W(`<rect style="fill:\\75&#13;&#10;rl(https://evil.test/a#a)"/>`),
    ],
    [
      "image-set in a style attribute (entity CRLF)",
      W(
        `<rect style="mask-image:\\69&#13;&#10;mage-set('https://evil.test/a' 1x)"/>`,
      ),
    ],
    [
      "url() split by a form feed",
      W(
        `<rect/>`,
        `<style>a{background:\\75&#12;rl(https://evil.test/a)}</style>`,
      ),
    ],
    [
      "url() split by a lone CR",
      W(
        `<rect/>`,
        `<style>a{background:\\75\rrl(https://evil.test/a)}</style>`,
      ),
    ],
    [
      "url() split by a lone LF",
      W(
        `<rect/>`,
        `<style>a{background:\\75\nrl(https://evil.test/a)}</style>`,
      ),
    ],
  ])("rejects %s", (_name, svg) => {
    expect(isSafeSvg(svg).ok).toBe(false);
  });

  it("still accepts a CSS escape that is not hiding anything", () => {
    expect(isSafeSvg(W(`<rect/>`, `<style>.a\\:b{fill:#fff}</style>`))).toEqual(
      { ok: true },
    );
  });
});
