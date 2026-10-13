import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REVEAL_SHOW_CSS } from "@/components/site/reveal-style";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("<Reveal> fallbacks for visitors the animation cannot reach", () => {
  it("the show-everything rule overrides the inline hidden state", () => {
    expect(REVEAL_SHOW_CSS).toContain("[data-reveal]");
    expect(REVEAL_SHOW_CSS).toMatch(/opacity:\s*1\s*!important/);
    expect(REVEAL_SHOW_CSS).toMatch(/transform:\s*none\s*!important/);
  });

  it("the locale layout puts that rule in a <noscript> inside <head>", () => {
    const layout = read("src/app/[locale]/layout.tsx");
    const head = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"));
    expect(head).toMatch(/<noscript>\s*<style dangerouslySetInnerHTML=\{\{ __html: REVEAL_SHOW_CSS \}\} \/>\s*<\/noscript>/);
  });

  it("globals.css shows reveals in print", () => {
    const css = read("src/app/globals.css");
    const print = css.slice(css.indexOf("@media print"));
    expect(css).toContain("@media print");
    expect(print).toMatch(/\[data-reveal\]\s*\{[^}]*opacity:\s*1\s*!important[^}]*transform:\s*none\s*!important/);
  });
});
