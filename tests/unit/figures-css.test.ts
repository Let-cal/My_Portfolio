import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Rules of the figure CSS modules that a jsdom render cannot see: CSS modules are not layered, so a box-shadow
 * here beats Tailwind's layered focus ring (also a box-shadow); and captions are clamped, never cut to one line.
 */
const dir = "src/components/sections/case-study/figures";
const figuresCss = readFileSync(`${dir}/figures.module.css`, "utf8");
const viewerCss = readFileSync(`${dir}/viewer.module.css`, "utf8");

/** Declarations of every rule whose selector list is exactly `selector` (comments stripped). */
function bodiesOf(css: string, selector: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  for (const [, sel, body] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const list = sel.split(",").map((s) => s.trim());
    if (list.includes(selector)) out.push(body);
  }
  return out;
}
const decl = (bodies: string[], prop: string) =>
  bodies
    .flatMap((b) => [
      ...b.matchAll(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`, "g")),
    ])
    .map((m) => m[1].trim());

describe("viewer index: the current item", () => {
  const current = bodiesOf(viewerCss, '.item[aria-current="true"]');

  it("is marked without a box-shadow, so the focus ring stays visible on it", () => {
    expect(current.length).toBeGreaterThan(0);
    expect(decl(current, "box-shadow")).toEqual([]);
    expect(decl(bodiesOf(viewerCss, ".item"), "box-shadow")).toEqual([]);
  });

  it("still shows the koi bar, as a left border", () => {
    expect(decl(current, "border-left-color")).toEqual(["var(--fv-koi)"]);
    expect(decl(bodiesOf(viewerCss, ".item"), "border-left")).toEqual([
      "2px solid transparent",
    ]);
  });
});

describe("figures view: caption and note", () => {
  const caption = bodiesOf(figuresCss, ".caption");
  const note = bodiesOf(figuresCss, ".note");

  it("the caption wraps to two lines and reserves both, so the fit measure sees the tallest block", () => {
    expect(decl(caption, "-webkit-line-clamp")).toEqual(["2"]);
    expect(decl(caption, "line-clamp")).toEqual(["2"]);
    expect(decl(caption, "white-space")).not.toContain("nowrap");
    const lineHeight = parseFloat(decl(caption, "line-height")[0]);
    expect(parseFloat(decl(caption, "min-height")[0])).toBe(2 * lineHeight);
  });

  it("the note stays one line", () => {
    expect(decl(note, "white-space")).toEqual(["nowrap"]);
    expect(decl(note, "text-overflow")).toEqual(["ellipsis"]);
  });
});
