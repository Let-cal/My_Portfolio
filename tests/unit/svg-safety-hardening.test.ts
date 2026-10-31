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

// Round 4: the checker models the browser's pipeline in order. XML first (raw line
// endings become LF, then the document is tokenised, then attribute values are
// whitespace-normalised and references expanded), then CSS (CR/CRLF/FF become LF, then
// escapes are resolved). Each describe block pins one boundary of that pipeline.
const BS = "\\";
const RED_RECT = `<rect width="100" height="100" fill="red"/>`;
const EVIL = (tag: string) => `https://evil.test/${tag}`;

describe("isSafeSvg XML end-of-line handling runs before references are expanded", () => {
  it.each([
    [
      "url() hidden by &#13; + raw CRLF in a style element",
      W(
        RED_RECT,
        `<style>svg{background-image:${BS}75&#13;\r\nrl(${EVIL("a")})}</style>`,
      ),
    ],
    [
      "url() hidden by &#13; + raw CR in a style element",
      W(
        RED_RECT,
        `<style>svg{background-image:${BS}75&#13;\rrl(${EVIL("a")})}</style>`,
      ),
    ],
    [
      "@import hidden by &#13; + raw CRLF in a style element",
      W(RED_RECT, `<style>@${BS}69&#13;\r\nmport "${EVIL("a.css")}";</style>`),
    ],
    [
      "image-set hidden by &#13; + raw CR in a style element",
      W(
        RED_RECT,
        `<style>svg{background-image:${BS}69&#13;\rmage-set("${EVIL("a")}" 1x)}</style>`,
      ),
    ],
  ])("rejects %s", (_name, svg) => {
    expect(isSafeSvg(svg).ok).toBe(false);
  });

  it("accepts a raw CR followed by &#10; (LF + LF: the escape swallows one, no url token)", () => {
    // The raw CR becomes LF before &#10; is expanded, so CSS sees two newlines and
    // "\75" + LF + "rl(" is not url( (Chromium fetches nothing for it either).
    expect(
      isSafeSvg(
        W(
          RED_RECT,
          `<style>svg{background-image:${BS}75\r&#10;rl(${EVIL("a")})}</style>`,
        ),
      ),
    ).toEqual({ ok: true });
  });
});

describe("isSafeSvg attribute values are whitespace-normalised before references", () => {
  it.each([
    ["a raw LF", "\n"],
    ["a raw TAB", "\t"],
    ["a raw CRLF", "\r\n"],
  ])(
    "rejects url() hidden by %s in a style attribute (it becomes a space)",
    (_n, sep) => {
      expect(
        isSafeSvg(
          W(
            `<rect width="1" height="1" style="fill:${BS}75${sep}rl(${EVIL("a")}#a)"/>`,
          ),
        ).ok,
      ).toBe(false);
    },
  );

  it("accepts &#13; + raw CRLF in a style attribute (CR + space: no url token)", () => {
    expect(
      isSafeSvg(
        W(`<rect width="1" height="1" style="fill:${BS}75&#13;\r\nrl(#a)"/>`),
      ),
    ).toEqual({ ok: true });
  });
});

describe("isSafeSvg reads only well-formed XML, the way the browser reads it", () => {
  it.each([
    [
      "XML version 1.1 (other end-of-line rules)",
      `<?xml version="1.1"?>` + W(`<rect/>`),
    ],
    [
      "an Ogham space mark inside a tag (an XML name character)",
      W(`<rect a="b"/>`),
    ],
    ["]]> in text", W(`<text>a]]>b</text>`)],
    ["an undefined entity (&nbsp;)", W(`<text>a&nbsp;b</text>`)],
    ["an entity with the wrong case (&AMP;)", W(`<text>a&AMP;b</text>`)],
    ["a bare &", W(`<text>a & b</text>`)],
    ["an upper-case hex reference (&#X41;)", W(`<text>&#X41;</text>`)],
    ["a reference to NUL", W(`<text>&#0;</text>`)],
    ["a reference to a C0 control", W(`<text>&#27;</text>`)],
    ["a reference to a surrogate", W(`<text>&#xD800;</text>`)],
    ["a reference to U+FFFE", W(`<text>&#xFFFE;</text>`)],
    ["a raw U+FFFF", W(`<text>a￿b</text>`)],
    ["a bad reference in an attribute", W(`<rect id="a&b"/>`)],
  ])("rejects %s", (_name, svg) => {
    expect(isSafeSvg(svg).ok).toBe(false);
  });

  it("accepts a byte order mark before the XML declaration", () => {
    expect(
      isSafeSvg("﻿" + `<?xml version="1.0" encoding="UTF-8"?>` + W(`<rect/>`)),
    ).toEqual({ ok: true });
  });

  it("accepts the five predefined entities and numeric references", () => {
    expect(
      isSafeSvg(
        W(
          `<text id="a&amp;b">&lt;T&gt; &quot;x&quot; &apos;y&apos; &#160;&#xA0;&#x1F600;</text>`,
        ),
      ),
    ).toEqual({ ok: true });
  });
});

describe("isSafeSvg trims URLs the way the URL parser does", () => {
  it.each([
    [
      "url() whose value starts with a no-break space (a relative URL)",
      W(RED_RECT, `<style>svg{background-image:url(&#160;#a)}</style>`),
    ],
    [
      "a quoted url() whose value starts with a no-break space",
      W(RED_RECT, `<style>svg{background-image:url("&#160;#a")}</style>`),
    ],
    [
      "a fill url() whose value starts with a no-break space",
      W(`<rect width="1" height="1" fill="url(&#160;#a)"/>`),
    ],
    [
      "an href that starts with a no-break space",
      W(`<defs><pattern id="p" href="&#160;#q" width="1" height="1"/></defs>`),
    ],
    [
      "url() whose value starts with a CSS escape for NUL",
      W(RED_RECT, `<style>svg{background-image:url(${BS}0 #a)}</style>`),
    ],
    [
      "a CSS escape for a surrogate",
      W(RED_RECT, `<style>svg{background-image:url(${BS}D800 #a)}</style>`),
    ],
  ])("rejects %s", (_name, svg) => {
    expect(isSafeSvg(svg).ok).toBe(false);
  });

  it("accepts url() and href with plain spaces around a fragment", () => {
    expect(
      isSafeSvg(
        W(
          `<defs><pattern id="p" href=" #q " width="1" height="1"/></defs><rect width="1" height="1" fill="url( #p )"/>`,
          `<style>rect{fill:url( "#p" )}</style>`,
        ),
      ),
    ).toEqual({ ok: true });
  });
});
