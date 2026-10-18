import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("scaffold smoke test", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });

  it("ships the Tech Lead CV PDF", () => {
    const pdf = resolve(process.cwd(), "public/cv/LeTranCatLam_CV_TechLead.pdf");
    expect(existsSync(pdf)).toBe(true);
  });

  it("ships the Technical PM CV PDF", () => {
    const pdf = resolve(process.cwd(), "public/cv/LeTranCatLam_CV_TechnicalPM.pdf");
    expect(existsSync(pdf)).toBe(true);
  });
});
