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
 * Elements a Mermaid 12.2.0 diagram (flowchart, erDiagram, sequenceDiagram, stateDiagram,
 * classDiagram, with htmlLabels off) and the hand-written seed figures contain, plus the
 * inert gradient, clip and pattern elements of the same family. Everything else is
 * rejected: script, foreignObject, animate*, set, use, image, a, any XHTML or prefixed
 * element. Names are compared exactly (XML is case-sensitive).
 */
export const ALLOWED_SVG_ELEMENTS: ReadonlySet<string> = new Set([
  "svg",
  "g",
  "defs",
  "symbol",
  "marker",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "title",
  "desc",
  "style",
  "clipPath",
  "linearGradient",
  "radialGradient",
  "stop",
  "pattern",
  "filter",
  "feDropShadow",
]);

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const ATTR_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*(?::[A-Za-z_][A-Za-z0-9_.-]*)?$/;
const NUMERIC_LIST = /^[\d\s.,eE+-]*$/;
const SMIL_ATTRS =
  /^(?:attributeName|from|to|by|begin|end|dur|repeatCount|keyTimes|keySplines)$/i;

type Tag = {
  name: string;
  closing: boolean;
  selfClosing: boolean;
  attrs: { name: string; value: string }[];
  end: number;
};

class SvgReject extends Error {}

function reject(reason: string): never {
  throw new SvgReject(reason);
}

/**
 * Reads the tag that starts at text[start] === "<". The grammar is the XML one:
 * quoted attribute values only, and no comments, CDATA, doctype or processing
 * instructions (those are refused before this point), so every tag this reads is a tag
 * an XML parser reads the same way.
 */
function readTag(text: string, start: number): Tag {
  let i = start + 1;
  const closing = text[i] === "/";
  if (closing) i++;
  const nameStart = i;
  while (i < text.length && !/[\s/>]/.test(text[i])) i++;
  const name = text.slice(nameStart, i);
  if (!name) reject("SVG contains a stray < that does not start a tag.");
  const attrs: Tag["attrs"] = [];
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) reject("SVG ends inside a tag.");
    if (text[i] === ">") {
      return { name, closing, selfClosing: false, attrs, end: i + 1 };
    }
    if (text[i] === "/") {
      if (text[i + 1] !== ">") reject("SVG contains a malformed tag.");
      return { name, closing, selfClosing: true, attrs, end: i + 2 };
    }
    if (closing) reject("SVG contains a malformed closing tag.");
    const attrStart = i;
    while (i < text.length && !/[\s=/>]/.test(text[i])) i++;
    const attrName = text.slice(attrStart, i);
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] !== "=") {
      reject(`SVG attribute "${attrName.slice(0, 30)}" has no value.`);
    }
    i++;
    while (i < text.length && /\s/.test(text[i])) i++;
    const quote = text[i];
    if (quote !== '"' && quote !== "'") {
      reject(`SVG attribute "${attrName.slice(0, 30)}" is not quoted.`);
    }
    const close = text.indexOf(quote, i + 1);
    if (close === -1) reject("SVG has an unterminated attribute value.");
    const value = text.slice(i + 1, close);
    if (value.includes("<")) reject("SVG attribute value contains <.");
    attrs.push({ name: attrName, value });
    i = close + 1;
    if (i < text.length && !/[\s/>]/.test(text[i])) {
      reject("SVG attributes must be separated by whitespace.");
    }
  }
}

function checkAttribute(name: string, rawValue: string): void {
  if (!ATTR_NAME.test(name)) {
    reject(
      `SVG contains an attribute with an unsupported name "${name.slice(0, 30)}".`,
    );
  }
  const value = decodeEntities(rawValue);
  if (name === "xmlns") {
    if (value !== SVG_NS)
      reject("SVG declares a namespace other than SVG (xmlns).");
    return;
  }
  if (name === "xmlns:xlink") {
    if (value !== XLINK_NS) {
      reject("SVG declares a namespace other than xlink (xmlns:xlink).");
    }
    return;
  }
  if (name.startsWith("xmlns"))
    reject("SVG declares an extra namespace (xmlns:*).");
  if (name.includes(":") && name !== "xlink:href") {
    reject(`SVG contains a prefixed attribute "${name}".`);
  }
  if (/^on/i.test(name))
    reject("SVG contains an event handler attribute (on*=).");
  if (SMIL_ATTRS.test(name)) {
    reject(
      "SVG contains an SMIL animation attribute (attributeName/from/to/by).",
    );
  }
  if (/^values$/i.test(name) && !NUMERIC_LIST.test(value)) {
    reject("SVG contains an SMIL animation attribute (values).");
  }
  if (/^(?:xlink:)?href$/i.test(name) && !FRAGMENT.test(value.trim())) {
    reject(
      `SVG href must be a #fragment, found "${value.trim().slice(0, 40)}".`,
    );
  }
}

/**
 * Allowlist safety check for an SVG that will be served as an image.
 * It needs no DOM, so the browser (before upload) and the server (save action) run the
 * same code. The markup is tokenised with XML rules and only listed elements,
 * attributes and namespaces pass; CSS (style elements and attribute values) is then
 * checked for url(), @import and fetching functions. It is deliberately strict: it may
 * reject odd but harmless markup, never the reverse.
 */
export function isSafeSvg(svg: string): SvgCheck {
  if (typeof svg !== "string") return { ok: false, reason: "SVG is not text." };
  if (new TextEncoder().encode(svg).length > SVG_MAX_BYTES) {
    return { ok: false, reason: "SVG is larger than 1 MB." };
  }
  try {
    checkDocument(svg);
    return { ok: true };
  } catch (error) {
    if (error instanceof SvgReject) return { ok: false, reason: error.message };
    throw error;
  }
}

function checkDocument(svg: string): void {
  if (/<!ENTITY/i.test(svg)) reject("SVG declares an XML ENTITY.");
  if (/<!DOCTYPE/i.test(svg)) reject("SVG contains a DOCTYPE declaration.");

  let pos = 0;
  // An optional XML declaration may open the file; no other processing instruction.
  const prolog = /^\s*<\?xml\s[^>]*\?>/.exec(svg);
  if (prolog) pos = prolog[0].length;

  const stack: string[] = [];
  const styles: string[] = [];
  const attrValues: string[] = [];
  const outside: string[] = [];
  let sawRoot = false;
  let rootClosed = false;

  while (pos < svg.length) {
    const lt = svg.indexOf("<", pos);
    const text = svg.slice(pos, lt === -1 ? svg.length : lt);
    if (text.trim() !== "" && (stack.length === 0 || rootClosed)) {
      reject(
        sawRoot
          ? "SVG has text after the root element."
          : "Not an SVG document (text before the <svg> root).",
      );
    }
    if (stack[stack.length - 1] === "style") {
      styles.push(decodeEntities(text));
    } else {
      outside.push(text);
    }
    if (lt === -1) break;
    const next = svg[lt + 1];
    if (next === "!") {
      reject("SVG contains a comment, CDATA section or declaration.");
    }
    if (next === "?") reject("SVG contains a processing instruction.");
    const tag = readTag(svg, lt);
    pos = tag.end;
    const { name } = tag;

    if (!ALLOWED_SVG_ELEMENTS.has(name)) {
      reject(
        name.includes(":")
          ? `SVG contains a namespace-prefixed element <${name.slice(0, 30)}>.`
          : !sawRoot
            ? "Not an SVG document (the root element must be <svg>)."
            : `SVG contains the element <${name.slice(0, 30)}>, which is not allowed.`,
      );
    }
    if (tag.closing) {
      if (stack.pop() !== name) reject("SVG tags are not properly nested.");
      if (stack.length === 0) rootClosed = true;
      continue;
    }
    if (rootClosed) reject("SVG has more than one root element.");
    if (!sawRoot) {
      if (name !== "svg") {
        reject("Not an SVG document (the root element must be <svg>).");
      }
      sawRoot = true;
    }
    if (stack[stack.length - 1] === "style") {
      reject("SVG <style> may contain only text.");
    }
    for (const attr of tag.attrs) {
      checkAttribute(attr.name, attr.value);
      attrValues.push(decodeEntities(attr.value));
    }
    if (tag.selfClosing) {
      if (stack.length === 0) rootClosed = true;
    } else {
      stack.push(name);
    }
  }
  if (!sawRoot) reject("Not an SVG document (no <svg> element).");
  if (stack.length > 0) reject("SVG has unclosed tags.");

  // CSS lives in <style> text and in attribute values. Embedded woff2 fonts are allowed
  // in <style> only; url() elsewhere must be a #fragment. Text nodes are not CSS, so
  // only the unambiguous url( and @import tokens are looked for there.
  for (const css of styles) {
    const decoded = decodeCssEscapes(css);
    const problem = checkCssFunctions(decoded) ?? checkUrls(decoded, true);
    if (problem) reject(problem);
  }
  for (const value of attrValues) {
    const problem = checkCssFunctions(decodeCssEscapes(value));
    if (problem) reject(problem);
  }
  const problem = checkUrls(
    decodeCssEscapes([...outside, ...attrValues].join("\n")),
    false,
  );
  if (problem) reject(problem);
}

function sanitizeWithProfile(svg: string): string {
  return DOMPurify.sanitize(svg, {
    // Only the elements isSafeSvg allows (DOMPurify compares lower-case names).
    ALLOWED_TAGS: [...ALLOWED_SVG_ELEMENTS].map((name) => name.toLowerCase()),
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
    // Prefixed attributes other than xlink:href are not part of the allowlist either.
    for (const attr of Array.from(node.attributes ?? [])) {
      if (
        attr.name.includes(":") &&
        !["xlink:href", "xmlns:xlink"].includes(attr.name)
      ) {
        node.removeAttribute(attr.name);
      }
    }
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
