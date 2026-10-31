import DOMPurify from "dompurify";

export const SVG_MAX_BYTES = 1024 * 1024;

export type SvgCheck = { ok: true } | { ok: false; reason: string };

const FRAGMENT = /^#[A-Za-z0-9_.:-]+$/;
const FONT_DATA_URL = /^data:font\/woff2;base64,[A-Za-z0-9+/]+={0,2}$/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Decodes the XML character references a browser would decode before it reads a value. */
function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi,
    (match, hex: string, dec: string, name: string) => {
      if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? match;
      const code = hex ? parseInt(hex, 16) : parseInt(dec, 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    },
  );
}

/** Resolves CSS escapes such as \75 rl( so they cannot hide a url() or @import. */
function decodeCssEscapes(css: string): string {
  return css.replace(
    /\\(?:([0-9a-f]{1,6})[ \t\r\n\f]?|([^\n]))/gi,
    (_m, hex, ch) => {
      if (hex) {
        const code = parseInt(hex, 16);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
      }
      return ch as string;
    },
  );
}

const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;

/** CSS functions that can fetch a resource without url(); checked in CSS contexts only. */
function checkCssFunctions(css: string): string | null {
  if (
    /(?<![A-Za-z0-9_])(?:image-set|image|src|cross-fade|element|expression)\s*\(|-moz-binding|behavior\s*:/i.test(
      css,
    )
  ) {
    return "SVG contains a CSS construct that can load external content.";
  }
  return null;
}

/** Checks every url(...) in a piece of CSS or an attribute; data fonts only when allowed. */
function checkUrls(css: string, allowFontData: boolean): string | null {
  if (/@import/i.test(css)) return "SVG contains a CSS @import.";
  const re = /url\s*\(/gi;
  while (re.exec(css)) {
    const close = css.indexOf(")", re.lastIndex);
    if (close === -1) return "SVG contains an unterminated url(.";
    const raw = css
      .slice(re.lastIndex, close)
      .trim()
      .replace(/^(['"])([\s\S]*)\1$/, "$2")
      .trim();
    if (FRAGMENT.test(raw)) continue;
    if (allowFontData && FONT_DATA_URL.test(raw)) continue;
    return "SVG contains a url( that is not a #fragment or an embedded woff2 font.";
  }
  return null;
}

/**
 * String-level safety check for an SVG that will be served as an image.
 * It needs no DOM, so the browser (before upload) and the server (save action) run the
 * same code. It is deliberately strict: it may reject odd but harmless markup, never
 * the reverse.
 */
export function isSafeSvg(svg: string): SvgCheck {
  if (typeof svg !== "string") return { ok: false, reason: "SVG is not text." };
  if (new TextEncoder().encode(svg).length > SVG_MAX_BYTES) {
    return { ok: false, reason: "SVG is larger than 1 MB." };
  }
  // Entities are decoded once, like a browser would, so &#106;avascript: cannot hide.
  const text = decodeEntities(svg);

  if (!/<svg[\s>]/i.test(text)) {
    return { ok: false, reason: "Not an SVG document (no <svg> element)." };
  }
  if (/<!ENTITY/i.test(text)) {
    return { ok: false, reason: "SVG declares an XML ENTITY." };
  }
  if (/<!DOCTYPE/i.test(text)) {
    return { ok: false, reason: "SVG contains a DOCTYPE declaration." };
  }
  if (/<\?(?!xml\s)/i.test(text)) {
    return { ok: false, reason: "SVG contains a processing instruction." };
  }
  // In an XML SVG any prefix bound to the SVG or XHTML namespace makes a real element
  // (<s:script>, <h:iframe>, <s:set>), which the name checks below would not see.
  // Mermaid output and hand-written figures use no prefixed elements, so reject them all.
  if (/<\/?[A-Za-z_][\w.-]*:[A-Za-z_]/.test(text)) {
    return {
      ok: false,
      reason:
        "SVG contains a namespace-prefixed element (for example <s:script>).",
    };
  }
  if (/<script/i.test(text)) {
    return { ok: false, reason: "SVG contains a <script> element." };
  }
  if (/<foreignObject/i.test(text)) {
    return { ok: false, reason: "SVG contains a <foreignObject> element." };
  }
  if (
    /<(?:iframe|embed|object|link|meta|base|audio|video|handler|listener)\b/i.test(
      text,
    )
  ) {
    return {
      ok: false,
      reason: "SVG contains an element that can load external content.",
    };
  }
  if (/<(?:animate|set)/i.test(text)) {
    return {
      ok: false,
      reason: "SVG contains an animation element (animate/set).",
    };
  }
  // SMIL can rewrite an href or other attribute at run time: reject its attributes too,
  // so a missed animation element is still not enough. A numeric values= (feColorMatrix)
  // is harmless and allowed.
  if (/[\s"'/](?:attributeName|from|to|by)\s*=/i.test(text)) {
    return {
      ok: false,
      reason:
        "SVG contains an SMIL animation attribute (attributeName/from/to/by).",
    };
  }
  const valuesRe = /[\s"'/]values\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  let v: RegExpExecArray | null;
  while ((v = valuesRe.exec(text))) {
    if (!/^[\d\s.,eE+-]*$/.test(v[1] ?? v[2] ?? v[3] ?? "")) {
      return {
        ok: false,
        reason: "SVG contains an SMIL animation attribute (values).",
      };
    }
  }
  if (/xml:base\s*=/i.test(text)) {
    return { ok: false, reason: "SVG sets xml:base." };
  }
  if (/[\s"'/]on[a-z]+\s*=/i.test(text)) {
    return {
      ok: false,
      reason: "SVG contains an event handler attribute (on*=).",
    };
  }

  // Every href / xlink:href must be a same-document #fragment.
  const hrefRe = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  let h: RegExpExecArray | null;
  while ((h = hrefRe.exec(text))) {
    const value = (h[1] ?? h[2] ?? h[3] ?? "").trim();
    if (!FRAGMENT.test(value)) {
      return {
        ok: false,
        reason: `SVG href must be a #fragment, found "${value.slice(0, 40)}".`,
      };
    }
  }

  // CSS: embedded woff2 fonts are allowed in the SVG's own <style> only.
  // Style blocks are found in the raw markup (an escaped &lt;style&gt; inside an
  // attribute is not a style element), then each piece is entity-decoded on its own.
  const styles: string[] = [];
  const outside = decodeEntities(
    svg.replace(STYLE_BLOCK, (_m, css: string) => {
      styles.push(decodeEntities(css));
      return "";
    }),
  );
  for (const css of styles) {
    const decoded = decodeCssEscapes(css);
    const problem = checkCssFunctions(decoded) ?? checkUrls(decoded, true);
    if (problem) return { ok: false, reason: problem };
  }
  for (const m of outside.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const problem = checkCssFunctions(decodeCssEscapes(m[1] ?? m[2] ?? ""));
    if (problem) return { ok: false, reason: problem };
  }
  const problem = checkUrls(decodeCssEscapes(outside), false);
  if (problem) return { ok: false, reason: problem };

  return { ok: true };
}

function sanitizeWithProfile(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      "script",
      "foreignobject",
      "animate",
      "animatecolor",
      "animatemotion",
      "animatetransform",
      "set",
    ],
    // Keep Mermaid's own markup (ids, classes, inline styles, markers).
    ADD_ATTR: [
      "marker-start",
      "marker-mid",
      "marker-end",
      "xmlns",
      "xmlns:xlink",
    ],
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  }) as string;
}

/**
 * Sanitises a rendered SVG with DOMPurify (SVG profile) and re-checks it with isSafeSvg.
 * Browser only: DOMPurify needs a DOM. Throws if the result is still not safe.
 * DOMPurify leaves the text of a <style> element alone, so an embedded
 * data:font/woff2 @font-face passes through; isSafeSvg then confirms it is the only
 * external-looking thing left.
 */
export function sanitizeSvg(svg: string): string {
  if (!DOMPurify.isSupported) {
    throw new Error("sanitizeSvg needs a browser DOM.");
  }
  // DOMPurify lets https: links through; a figure needs none, so any href that is
  // not a same-document #fragment is dropped here (isSafeSvg would otherwise reject the SVG).
  const dropForeignHrefs = (node: Element) => {
    for (const name of ["href", "xlink:href"]) {
      const value = node.getAttribute?.(name);
      if (
        value !== null &&
        value !== undefined &&
        !FRAGMENT.test(value.trim())
      ) {
        node.removeAttribute(name);
      }
    }
  };
  DOMPurify.addHook("afterSanitizeAttributes", dropForeignHrefs);
  let clean: string;
  try {
    clean = sanitizeWithProfile(svg);
  } finally {
    DOMPurify.removeHook("afterSanitizeAttributes", dropForeignHrefs);
  }
  // The HTML serialiser writes a no-break space as an entity that standalone XML lacks.
  clean = clean.replace(/&nbsp;/g, "&#160;");
  if (!/^\s*<svg[^>]*\sxmlns\s*=/i.test(clean)) {
    clean = clean.replace(
      /^\s*<svg/i,
      '<svg xmlns="http://www.w3.org/2000/svg"',
    );
  }
  const check = isSafeSvg(clean);
  if (!check.ok) throw new Error(`Unsafe SVG: ${check.reason}`);
  return clean;
}
