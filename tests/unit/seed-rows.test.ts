import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { TABLES } from "@/lib/data/columns";
import { buildSeedRows, renderSeedSql } from "@/lib/data/seed-rows";

const content = contentSchema.parse(seed);
const rows = buildSeedRows(content);

describe("seed rows", () => {
  it("covers every table, in the order foreign keys need", () => {
    expect(Object.keys(rows)).toEqual(Object.keys(TABLES));
    const order = Object.keys(rows);
    expect(order.indexOf("skill_links")).toBeGreaterThan(order.indexOf("projects"));
  });

  it("keeps one row per content item", () => {
    expect(rows.experiences).toHaveLength(content.experiences.length);
    expect(rows.why_cards).toHaveLength(content.whyCards.length);
    const linkCount = content.skills.reduce((n, s) => n + s.experienceIds.length + s.projectIds.length, 0);
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
      activities: [{ ...rows.activities[0], name: { en: "Cat's talk", ja: "x", vi: "y" }, skills: ["O'Reilly"] }],
    });
    expect(one).toContain(`'{"en":"Cat''s talk","ja":"x","vi":"y"}'::jsonb`);
    expect(one).toContain("array['O''Reilly']::text[]");
  });

  it("never contains a phone number", () => {
    expect(sql).not.toMatch(/(\+84|\b0)\d{2,3}[\s.]?\d{3}[\s.]?\d{3,4}\b/);
  });
});
