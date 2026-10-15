const MOBILE_TECH = /^(flutter|dart)$/i;
const WEB_TECH = /^(react|next\.js|java servlet)$/i;

/** "WEB", "MOBILE" or "WEB + MOBILE" from the tech list; null when nothing in it says which. */
export function projectKind(tech: string[]): "WEB" | "MOBILE" | "WEB + MOBILE" | null {
  const mobile = tech.some((name) => MOBILE_TECH.test(name));
  const web = tech.some((name) => WEB_TECH.test(name));
  return web && mobile ? "WEB + MOBILE" : mobile ? "MOBILE" : web ? "WEB" : null;
}
