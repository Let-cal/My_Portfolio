// Admin only (browser). DOMPurify pass over a Mermaid rendering, followed by the
// DOM-free isSafeSvg check. Kept out of src/lib/figures so the public bundle and the
// server action, which import isSafeSvg, never pull DOMPurify in.
import DOMPurify from "dompurify";
import { ALLOWED_SVG_ELEMENTS, isSafeSvg } from "@/lib/figures/svg-safety";

const FRAGMENT = /^#[A-Za-z0-9_.:-]+$/;

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
