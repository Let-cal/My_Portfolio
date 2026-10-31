import { describe, expect, it } from "vitest";
import {
  FIGURE_CATEGORIES,
  figureCategorySchema,
  figureSchema,
  projectSchema,
  type Figure,
} from "@/content/schema";
import seed from "@/content/seed.json";
import { FIGURE_KANJI } from "@/lib/figures/categories";
import { projectToRow, rowToProject } from "@/lib/data/mappers";

const text = (en: string) => ({ en });

const image = (id = "login-screen"): Figure => ({
  id,
  kind: "image",
  category: "screen",
  caption: text("Login screen"),
  note: text(""),
  alt: text("The login screen with an email field"),
  url: "/images/Illustration2.png",
  width: 1024,
  height: 1024,
});

const diagram = (id = "flow-overview"): Figure => ({
  id,
  kind: "diagram",
  category: "flow",
  caption: text("Request flow"),
  note: text("Redrawn from the code"),
  alt: text("Three boxes: client, API, database"),
  source: "flowchart LR\n  A --> B --> C",
  svgLight: "/seed/figures/seed-diagram-light.svg",
  svgDark: "/seed/figures/seed-diagram-dark.svg",
  width: 480,
  height: 160,
  renderedAt: "2026-10-31T00:00:00.000Z",
  themeVersion: 1,
});

/** A valid project taken from the seed, with the given media. */
function projectWith(media: unknown) {
  const base = seed.projects.find((p) => p.id === "zodiacgems")!;
  return { ...base, media };
}

describe("figure schema", () => {
  it("accepts an image figure and a diagram figure", () => {
    expect(figureSchema.safeParse(image()).success).toBe(true);
    expect(figureSchema.safeParse(diagram()).success).toBe(true);
    const parsed = projectSchema.safeParse(projectWith([image(), diagram()]));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.media).toHaveLength(2);
  });

  it("rejects a 13th figure", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => image(`fig-${i}`));
    expect(projectSchema.safeParse(projectWith(twelve)).success).toBe(true);
    const thirteen = [...twelve, image("fig-12")];
    expect(projectSchema.safeParse(projectWith(thirteen)).success).toBe(false);
  });

  it("rejects a caption over 140 characters in any locale", () => {
    const ok = "a".repeat(140);
    const long = "a".repeat(141);
    const withCaption = (caption: object) => ({ ...image(), caption });
    expect(figureSchema.safeParse(withCaption({ en: ok })).success).toBe(true);
    for (const locale of ["en", "ja", "vi"]) {
      const caption = { en: "ok", [locale]: long };
      expect(figureSchema.safeParse(withCaption(caption)).success, locale).toBe(
        false,
      );
    }
  });

  it("rejects a note over 100 characters", () => {
    const withNote = (note: object) => ({ ...image(), note });
    expect(
      figureSchema.safeParse(withNote({ en: "a".repeat(100) })).success,
    ).toBe(true);
    expect(
      figureSchema.safeParse(withNote({ en: "a".repeat(101) })).success,
    ).toBe(false);
    expect(
      figureSchema.safeParse(withNote({ en: "", ja: "a".repeat(101) })).success,
    ).toBe(false);
  });

  it("rejects a diagram source over 20 000 characters", () => {
    const withSource = (source: string) => ({ ...diagram(), source });
    expect(figureSchema.safeParse(withSource("a".repeat(20000))).success).toBe(
      true,
    );
    expect(figureSchema.safeParse(withSource("a".repeat(20001))).success).toBe(
      false,
    );
  });

  it("rejects two figures with the same id", () => {
    const result = projectSchema.safeParse(
      projectWith([image("same"), diagram("same")]),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(
      figureSchema.safeParse({ ...image(), category: "photo" }).success,
    ).toBe(false);
    expect(figureCategorySchema.safeParse("erd").success).toBe(true);
    expect([...FIGURE_CATEGORIES]).toEqual([
      "screen",
      "architecture",
      "erd",
      "flow",
      "other",
    ]);
  });

  it("defaults media to [] when the row has none", () => {
    // The seed project has no media key at all.
    const base = seed.projects.find((p) => p.id === "zodiacgems")!;
    expect("media" in base).toBe(false);
    expect(projectSchema.parse(base).media).toEqual([]);
    // A row read before the migration (or with a null column) maps to [].
    const row = { ...projectToRow(projectSchema.parse(base)), media: null };
    expect(rowToProject(row).media).toEqual([]);
  });

  it("maps media to the row and back", () => {
    const project = projectSchema.parse(projectWith([image(), diagram()]));
    const row = projectToRow(project);
    expect(row.media).toEqual(project.media);
    expect(rowToProject(row).media).toEqual(project.media);
  });

  it("has one kanji per category", () => {
    expect(FIGURE_KANJI).toEqual({
      screen: "画",
      architecture: "構",
      erd: "表",
      flow: "流",
      other: "他",
    });
  });
});
