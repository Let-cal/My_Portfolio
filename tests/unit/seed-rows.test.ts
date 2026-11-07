import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { creationOrder, TABLES } from "@/lib/data/columns";
import {
  buildSeedRows,
  renderSeedSql,
  withoutSeedFigures,
} from "@/lib/data/seed-rows";

const content = contentSchema.parse(seed);
const rows = buildSeedRows(content);

describe("seed rows", () => {
  it("covers every table, in the order foreign keys need", () => {
    const order = Object.keys(rows);
    expect(order).toEqual(creationOrder());
    expect([...order].sort()).toEqual(Object.keys(TABLES).sort());
    expect(order.indexOf("skill_links")).toBeGreaterThan(
      order.indexOf("projects"),
    );
    expect(order.indexOf("projects")).toBeGreaterThan(
      order.indexOf("experiences"),
    );
    expect(order.indexOf("projects")).toBeGreaterThan(
      order.indexOf("education"),
    );
  });

  it("keeps one row per content item", () => {
    expect(rows.experiences).toHaveLength(content.experiences.length);
    expect(rows.why_cards).toHaveLength(content.whyCards.length);
    const linkCount = content.skills.reduce(
      (n, s) => n + s.experienceIds.length + s.projectIds.length,
      0,
    );
    expect(rows.skill_links).toHaveLength(linkCount);
  });
});

describe("seed SQL", () => {
  const sql = renderSeedSql(rows);

  it("runs in one transaction and upserts by key", () => {
    expect(sql.startsWith("begin;\n")).toBe(true);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql).toContain("on conflict (key) do update set");
    expect(sql).toContain("delete from public.skill_links;");
  });

  it("escapes quotes and casts json and arrays", () => {
    const one = renderSeedSql({
      ...rows,
      activities: [
        {
          ...rows.activities[0],
          name: { en: "Cat's talk", ja: "x", vi: "y" },
          skills: ["O'Reilly"],
        },
      ],
    });
    expect(one).toContain(`'{"en":"Cat''s talk","ja":"x","vi":"y"}'::jsonb`);
    expect(one).toContain("array['O''Reilly']::text[]");
  });

  it("never contains a phone number", () => {
    expect(sql).not.toMatch(/(\+84|\b0)\d{2,3}[\s.]?\d{3}[\s.]?\d{3,4}\b/);
  });
});

describe("hosted seed (npm run db:seed)", () => {
  it("the seed has figures, which point at local /seed and /images files", () => {
    const media = content.projects.flatMap((p) => p.media);
    expect(media.length).toBeGreaterThan(0);
  });

  it("writes every project with media [] and leaves the rest of the row alone", () => {
    const hosted = withoutSeedFigures(rows);
    expect(Object.keys(hosted)).toEqual(Object.keys(rows));
    expect(hosted.projects).toHaveLength(rows.projects.length);
    hosted.projects.forEach((row, i) => {
      expect(row.media).toEqual([]);
      expect({ ...row, media: null }).toEqual({
        ...rows.projects[i],
        media: null,
      });
    });
    // The full rows (local seed fallback, e2e) keep the figures.
    expect(rows.projects.some((r) => (r.media as unknown[]).length > 0)).toBe(
      true,
    );
  });

  it("the seed script's SQL carries no seed figure paths", () => {
    const run = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/seed-supabase.ts", "--sql"],
      { encoding: "utf8" },
    );
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain("insert into public.projects");
    expect(run.stdout).not.toContain("/seed/figures/");
    expect(run.stdout).not.toContain('"kind":"diagram"');
  }, 30_000);
});
