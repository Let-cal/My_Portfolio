import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The panel's motion budget (spec 5.4): with motion on, every animation that carries text ends by 500 ms (the 果 seal
 * is decoration); under reduced motion, the open and close are a fade only, well inside that.
 */
const css = readFileSync(
  "src/components/sections/case-study/kakejiku.module.css",
  "utf8",
);

type Rule = { selector: string; name?: string; ms: number; delay: number };

/** Every rule under `[data-motion=...]` that sets an animation: its name, duration and delay in ms. */
function motionRules(mode: "full" | "reduced"): Rule[] {
  const rules: Rule[] = [];
  const block = /([^{}]+)\{([^{}]*)\}/g;
  for (const [, selector, body] of css.matchAll(block)) {
    if (!selector.includes(`[data-motion="${mode}"]`)) continue;
    const short =
      /animation:\s*([\w-]+)\s+(\d+)ms[^;]*?(?:\s(\d+)ms)?\s+both/.exec(body);
    const delay = /animation-delay:\s*(\d+)ms/.exec(body);
    if (short)
      rules.push({
        selector: selector.trim(),
        name: short[1],
        ms: Number(short[2]),
        delay: Number(short[3] ?? 0),
      });
    else if (delay)
      rules.push({ selector: selector.trim(), ms: 0, delay: Number(delay[1]) });
  }
  return rules;
}

describe("case study panel motion", () => {
  it("with motion on, the text is fully shown by 500 ms", () => {
    const rules = motionRules("full");
    const opening = rules.filter(
      (r) =>
        r.selector.includes('[data-state="open"]') &&
        !/\.seal/.test(r.selector),
    );
    expect(opening.length).toBeGreaterThan(4);
    // A delay-only rule (a later pane) keeps the duration of the rule it staggers.
    const paneMs = opening.find((r) => /\.pane$/.test(r.selector))!.ms;
    for (const rule of opening) {
      const end = rule.delay + (rule.name ? rule.ms : paneMs);
      expect(end, rule.selector).toBeLessThanOrEqual(500);
    }
  });

  it("under reduced motion, opening and closing are a fade of at most 150 ms", () => {
    const rules = motionRules("reduced");
    expect(rules.map((r) => r.name).sort()).toEqual([
      "kk-fade-in",
      "kk-fade-out",
    ]);
    for (const rule of rules) {
      expect(rule.ms).toBeLessThanOrEqual(150);
      expect(rule.delay).toBe(0);
    }
  });
});
