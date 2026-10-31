import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL(
    "../../src/components/sections/experience/journey.css",
    import.meta.url,
  ),
  "utf8",
).replace(/\r\n/g, "\n");

/** The declaration block of the first rule in `source` whose selector (list) is exactly `selector`. */
function block(source: string, selector: string): string {
  let from = 0;
  for (;;) {
    const at = source.indexOf(`${selector} {`, from);
    if (at === -1) throw new Error(`no rule for ${selector}`);
    const before = source.slice(0, at);
    // Must start a rule: the start of the text, or right after a closing brace or comment.
    if (/(^|[}\n])\s*$/.test(before) && !/,\s*$/.test(before))
      return source.slice(at, source.indexOf("}", at));
    from = at + 1;
  }
}

describe("tree row tap targets", () => {
  it.each([".jt-a", ".jt-more", ".jt-cs"])(
    "%s is at least 1.5rem tall and centred",
    (selector) => {
      const rule = block(css, selector);
      expect(rule).toMatch(/min-height:\s*1\.5rem/);
      expect(rule).toMatch(/display:\s*inline-flex/);
      expect(rule).toMatch(/align-items:\s*center/);
    },
  );

  it("grows to 2.75rem on a coarse pointer", () => {
    const start = css.indexOf("@media (pointer: coarse) {");
    expect(start).toBeGreaterThan(-1);
    const media = css.slice(start, css.indexOf("\n}", start));
    expect(block(media, ".jt-a,\n  .jt-more,\n  .jt-cs")).toMatch(
      /min-height:\s*2\.75rem/,
    );
  });
});
