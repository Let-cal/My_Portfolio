export const SVG_MAX_BYTES = 1024 * 1024;

export type SvgCheck = { ok: true } | { ok: false; reason: string };

const FRAGMENT = /^#[A-Za-z0-9_.:-]+$/;
const FONT_DATA_URL = /^data:font\/woff2;base64,[A-Za-z0-9+/]+={0,2}$/;

// The checker reads the document in the order the browser does:
//   1. a leading byte order mark is dropped;
//   2. XML end-of-line handling: raw CRLF and CR become LF before anything else, so
//      "&#13;" + raw CRLF is CR + LF (one CSS newline), never CR + CR + LF;
//   3. tokenising, with XML whitespace (space, tab, LF) only;
//   4. attribute values: raw whitespace becomes a space, then references are expanded;
//      element text: references are expanded, raw LF stays;
//   5. CSS (style text and attribute values): CRLF, CR and FF become LF, then escapes.
// Anything an XML parser refuses is refused here too, so the browser never renders a
// document (or the prefix of one) that the checker read differently.

/** XML whitespace (CR is gone after end-of-line handling; listed for safety). */
const XML_WS = /[ \t\n\r]/;
const PREDEFINED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};
const REFERENCE = /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|(amp|lt|gt|quot|apos));/y;

/** The XML 1.0 Char production: what a character reference may produce. */
function isXmlChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

/**
 * Expands XML references exactly as an XML parser does: only the five predefined
 * entities (case-sensitive) and numeric references to legal characters. Any other "&"
 * is a fatal error to the browser and a rejection here.
 */
function decodeEntities(text: string): string {
  let out = "";
  let pos = 0;
  for (let amp = text.indexOf("&"); amp !== -1; amp = text.indexOf("&", pos)) {
    REFERENCE.lastIndex = amp;
    const m = REFERENCE.exec(text);
    if (!m) reject("SVG contains an & that is not a valid XML reference.");
    let char: string;
    if (m[3]) {
      char = PREDEFINED_ENTITIES[m[3]];
    } else {
      const code = m[1] ? parseInt(m[1], 16) : parseInt(m[2], 10);
      if (!isXmlChar(code)) {
        reject("SVG contains a reference to a character XML does not allow.");
      }
      char = String.fromCodePoint(code);
    }
    out += text.slice(pos, amp) + char;
    pos = REFERENCE.lastIndex;
  }
  return out + text.slice(pos);
}

/** Step 4 for attributes: raw tab and LF become spaces, then references expand. */
function decodeAttributeValue(raw: string): string {
  return decodeEntities(raw.replace(/[\t\n\r]/g, " "));
}

/**
 * CSS text with its escapes resolved. escaped[i] is true when text[i] came from an
 * escape: an escaped quote or parenthesis is a literal character to the browser, never
 * a string delimiter or the end of a url( token.
 */
type DecodedCss = { text: string; escaped: boolean[] };

/** Resolves CSS escapes such as \75 rl( so they cannot hide a url() or @import. */
function decodeCss(css: string): DecodedCss {
  // CSS input preprocessing: CRLF, CR and FF all become LF before escapes are read, so
  // "\75" + CRLF + "rl(" is url( to the browser and must be url( here too.
  const pre = css.replace(/\r\n?|\f/g, "\n");
  const re = /\\(?:([0-9a-f]{1,6})[ \t\n]?|([^\n]))/gi;
  let text = "";
  const escaped: boolean[] = [];
  let pos = 0;
  for (let m = re.exec(pre); m; m = re.exec(pre)) {
    const literal = pre.slice(pos, m.index);
    text += literal;
    for (let k = 0; k < literal.length; k++) escaped.push(false);
    let char = m[2];
    if (m[1]) {
      const code = parseInt(m[1], 16);
      // The browser turns these into U+FFFD, which can make "url(\0 #a)" a relative
      // URL instead of a fragment; nothing legitimate needs them.
      if (code === 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff) {
        reject("SVG contains a CSS escape for an invalid code point.");
      }
      char = String.fromCodePoint(code);
    }
    text += char;
    for (let k = 0; k < char.length; k++) escaped.push(true);
    pos = re.lastIndex;
  }
  const rest = pre.slice(pos);
  text += rest;
  for (let k = 0; k < rest.length; k++) escaped.push(false);
  return { text, escaped };
}

function decodeCssEscapes(css: string): string {
  return decodeCss(css).text;
}

/** Strips CSS whitespace only (JS trim() would also strip a no-break space). */
function cssTrim(text: string): string {
  return text.replace(/^[ \t\n]+|[ \t\n]+$/g, "");
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
function checkUrls(decoded: DecodedCss, allowFontData: boolean): string | null {
  const css = decoded.text;
  if (/@import/i.test(css)) return "SVG contains a CSS @import.";
  const re = /url\s*\(/gi;
  while (re.exec(css)) {
    const close = css.indexOf(")", re.lastIndex);
    if (close === -1) return "SVG contains an unterminated url(.";
    // Inside url( an escaped quote is a literal URL character ("url(\22#a\22)" is the
    // relative URL '"#a"'), and an escaped ")" does not end the token. Neither Mermaid
    // nor the embedded font writes escapes there, so any escape is refused.
    for (let j = re.lastIndex; j <= close; j++) {
      if (decoded.escaped[j]) return "SVG contains a CSS escape inside url(.";
    }
    // Only what CSS strips is trimmed: "url(&#160;#a)" is a relative URL to the
    // browser, not a fragment.
    const raw = cssTrim(
      cssTrim(css.slice(re.lastIndex, close)).replace(
        /^(['"])([\s\S]*)\1$/,
        "$2",
      ),
    );
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
  while (i < text.length && !/[ \t\n\r/>]/.test(text[i])) i++;
  const name = text.slice(nameStart, i);
  if (!name) reject("SVG contains a stray < that does not start a tag.");
  const attrs: Tag["attrs"] = [];
  for (;;) {
    while (i < text.length && XML_WS.test(text[i])) i++;
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
    while (i < text.length && !/[ \t\n\r=/>]/.test(text[i])) i++;
    const attrName = text.slice(attrStart, i);
    while (i < text.length && XML_WS.test(text[i])) i++;
    if (text[i] !== "=") {
      reject(`SVG attribute "${attrName.slice(0, 30)}" has no value.`);
    }
    i++;
    while (i < text.length && XML_WS.test(text[i])) i++;
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
    if (i < text.length && !/[ \t\n\r/>]/.test(text[i])) {
      reject("SVG attributes must be separated by whitespace.");
    }
  }
}

/** Checks one attribute; the value is already normalised and reference-expanded. */
function checkAttribute(name: string, value: string): void {
  if (!ATTR_NAME.test(name)) {
    reject(
      `SVG contains an attribute with an unsupported name "${name.slice(0, 30)}".`,
    );
  }
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
  if (/^(?:xlink:)?href$/i.test(name)) {
    // The URL parser strips only leading and trailing C0 controls and spaces; a
    // no-break space in front of "#a" makes it a relative URL.
    const href = value.replace(/^[\u0000- ]+|[\u0000- ]+$/g, "");
    if (!FRAGMENT.test(href)) {
      reject(`SVG href must be a #fragment, found "${href.slice(0, 40)}".`);
    }
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

function checkDocument(input: string): void {
  // Steps 1 and 2: drop a leading byte order mark, then XML end-of-line handling.
  const svg = (input.charCodeAt(0) === 0xfeff ? input.slice(1) : input).replace(
    /\r\n?/g,
    "\n",
  );

  if (/<!ENTITY/i.test(svg)) reject("SVG declares an XML ENTITY.");
  if (/<!DOCTYPE/i.test(svg)) reject("SVG contains a DOCTYPE declaration.");

  // XML 1.0 forbids C0 controls other than tab, LF and CR (ESC switches ISO-2022-JP
  // into double-byte mode, which can move the markup boundaries), U+FFFE, U+FFFF and
  // unpaired surrogates.
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(
      svg,
    )
  ) {
    reject("SVG contains a control character that XML does not allow.");
  }

  let pos = 0;
  // An optional XML declaration may open the file: version 1.0 only (1.1 has other
  // end-of-line rules), no encoding or UTF-8 only (a declared ISO-2022-JP, Shift_JIS or
  // UTF-16 changes how the bytes are read); no other processing instruction.
  const prolog =
    /^<\?xml[ \t\n]+version[ \t\n]*=[ \t\n]*(["'])1\.0\1(?:[ \t\n]+encoding[ \t\n]*=[ \t\n]*(["'])[Uu][Tt][Ff]-8\2)?(?:[ \t\n]+standalone[ \t\n]*=[ \t\n]*(["'])(?:yes|no)\3)?[ \t\n]*\?>/.exec(
      svg,
    );
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
    if (/[^ \t\n]/.test(text) && (stack.length === 0 || rootClosed)) {
      reject(
        sawRoot
          ? "SVG has text after the root element."
          : "Not an SVG document (text before the <svg> root).",
      );
    }
    if (text.includes("]]>"))
      reject("SVG text contains ]]>, which XML refuses.");
    if (stack[stack.length - 1] === "style") {
      styles.push(decodeEntities(text));
    } else {
      outside.push(decodeEntities(text));
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
    const seen = new Set<string>();
    for (const attr of tag.attrs) {
      if (seen.has(attr.name))
        reject("SVG repeats an attribute on one element.");
      seen.add(attr.name);
      const value = decodeAttributeValue(attr.value);
      checkAttribute(attr.name, value);
      attrValues.push(value);
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
    const decoded = decodeCss(css);
    const problem = checkCssFunctions(decoded.text) ?? checkUrls(decoded, true);
    if (problem) reject(problem);
  }
  for (const value of attrValues) {
    const problem = checkCssFunctions(decodeCssEscapes(value));
    if (problem) reject(problem);
  }
  const problem = checkUrls(
    decodeCss([...outside, ...attrValues].join("\n")),
    false,
  );
  if (problem) reject(problem);
}
