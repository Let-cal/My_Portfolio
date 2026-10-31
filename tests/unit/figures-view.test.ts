import { describe, expect, it } from "vitest";
import type { Figure } from "@/content/schema";
import { FIGURE_KANJI } from "@/lib/figures/categories";
import { figureViews } from "@/lib/figures/view";

const image: Figure = {
  id: "shot",
  kind: "image",
  category: "screen",
  caption: { en: "Survey screen", ja: "調査画面" },
  note: { en: "" },
  alt: { en: "A survey screen", vi: "Man hinh khao sat" },
  url: "/images/shot.png",
  width: 800,
  height: 600,
};

const diagram: Figure = {
  id: "overview",
  kind: "diagram",
  category: "architecture",
  caption: { en: "Overview", ja: "", vi: "Tong quan" },
  note: { en: "Simplified", ja: "簡略化" },
  alt: { en: "Three boxes" },
  source: "flowchart LR\n  A --> B",
  svgLight: "/seed/figures/light.svg",
  svgDark: "/seed/figures/dark.svg",
  width: 480,
  height: 160,
  renderedAt: "2026-10-31T00:00:00.000Z",
  themeVersion: 1,
};

describe("figureViews", () => {
  it("never exposes the Mermaid source, renderedAt or themeVersion", () => {
    const json = JSON.stringify(figureViews([image, diagram], "en"));
    expect(json).not.toContain("source");
    expect(json).not.toContain("flowchart");
    expect(json).not.toContain("renderedAt");
    expect(json).not.toContain("themeVersion");
    expect(json).not.toContain("svgLight");
    expect(json).not.toContain("svgDark");
  });

  it("maps an image to src with no dark variant, and a diagram to its two SVGs", () => {
    const [a, b] = figureViews([image, diagram], "en");
    expect(a).toEqual({
      id: "shot",
      kind: "image",
      category: "screen",
      kanji: FIGURE_KANJI.screen,
      caption: "Survey screen",
      note: null,
      alt: "A survey screen",
      width: 800,
      height: 600,
      src: "/images/shot.png",
      srcDark: null,
    });
    expect(b).toMatchObject({
      kind: "diagram",
      kanji: FIGURE_KANJI.architecture,
      src: "/seed/figures/light.svg",
      srcDark: "/seed/figures/dark.svg",
    });
  });

  it("picks the locale and falls back to EN", () => {
    const [a, b] = figureViews([image, diagram], "ja");
    expect(a.caption).toBe("調査画面");
    expect(a.alt).toBe("A survey screen");
    expect(b.caption).toBe("Overview");
    expect(b.note).toBe("簡略化");
    const [, v] = figureViews([image, diagram], "vi");
    expect(v.caption).toBe("Tong quan");
    expect(v.note).toBe("Simplified");
  });

  it("an empty note becomes null", () => {
    const [a, b] = figureViews([image, diagram], "en");
    expect(a.note).toBeNull();
    expect(b.note).toBe("Simplified");
  });

  it("keeps the stored order", () => {
    expect(figureViews([diagram, image], "en").map((v) => v.id)).toEqual([
      "overview",
      "shot",
    ]);
    expect(figureViews([], "en")).toEqual([]);
  });
});
