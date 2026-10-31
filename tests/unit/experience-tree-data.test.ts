import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { buildSeedRows } from "@/lib/data/seed-rows";
import {
  dryRunData,
  LINKS_VARIANT,
  NEW_PROJECT_COLUMNS,
  withFrozenProjectText,
} from "../../scripts/ci/experience-tree-data";
import before from "../fixtures/seed-before-experience-tree.json";

const data = dryRunData(before, seed);

describe("experience tree dry-run data", () => {
  it("writes the frozen content for the schema before the migration", () => {
    const projectsInsert = data.beforeSql
      .split("\n")
      .find((l) => l.startsWith("insert into public.projects"))!;
    for (const col of NEW_PROJECT_COLUMNS)
      expect(projectsInsert).not.toMatch(new RegExp(`\\b${col}\\b`));
    for (const p of data.expectedBefore.projects)
      for (const col of NEW_PROJECT_COLUMNS) expect(p).not.toHaveProperty(col);
    expect(data.expectedBefore.experiences.map((e) => e.id)).toContain(
      "skg-flexybox-p2",
    );
  });

  it("gives one moved row Code, Demo and another link, mapped after the migration", () => {
    const { id, code, demo, other } = LINKS_VARIANT;
    expect(
      data.expectedBefore.experiences.find((e) => e.id === id)!.links,
    ).toEqual([
      { label: "Code", url: code },
      { label: "Demo", url: demo },
      other,
    ]);
    expect(data.expectedAfter.projects.find((p) => p.id === id)).toMatchObject({
      repo_urls: [code],
      demo_url: demo,
      links: [other],
    });
  });

  it("expects seed.json after the migration, apart from that variant", () => {
    // The migration leaves the project text columns alone, so the texts corrected on the live database after the
    // freeze (see seed.json) are expected as frozen.
    const rows = buildSeedRows(
      withFrozenProjectText(
        contentSchema.parse(seed),
        contentSchema.parse(before),
      ),
    );
    const strip = (list: Record<string, unknown>[]) =>
      list.filter((r) => r.id !== LINKS_VARIANT.id);
    expect(strip(data.expectedAfter.projects)).toEqual(strip(rows.projects));
    expect(data.expectedAfter.experiences).toEqual(rows.experiences);
    expect(data.expectedAfter.skill_links).toEqual(rows.skill_links);
    expect(data.expectedAfter.roles).toEqual(
      rows.roles.map((r) => ({
        key: r.key,
        experience_order: r.experience_order,
      })),
    );
    expect(data.expectedAfter.why_cards).toEqual(
      rows.why_cards.map((w) => ({ id: w.id, evidence_link: w.evidence_link })),
    );
  });

  it("keeps the corrected live texts out of the expected data, and only those", () => {
    const live = buildSeedRows(contentSchema.parse(seed)).projects;
    const expected = data.expectedAfter.projects;
    const differing = expected.flatMap((row) => {
      const current = live.find((r) => r.id === row.id)!;
      return Object.keys(row)
        .filter((k) => JSON.stringify(row[k]) !== JSON.stringify(current[k]))
        .map((k) => `${row.id}.${k}`);
    });
    expect(differing.sort()).toEqual(
      [
        "meet-my-lecturer.role",
        "meet-my-lecturer.summary",
        "meet-my-lecturer.tech",
        "meet-my-lecturer.repo_urls",
        "zodiacgems.role",
        "zodiacgems.demo_url",
        "siteplus.demo_url",
        // The Code/Demo/Docs variant row is exercised separately.
        "skg-coa.demo_url",
        "skg-coa.repo_urls",
        "skg-coa.links",
      ].sort(),
    );
  });
});
