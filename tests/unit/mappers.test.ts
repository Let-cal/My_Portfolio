import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import {
  activityToRow,
  certificateToRow,
  educationToRow,
  experienceToRow,
  profileToRow,
  projectToRow,
  roleToRow,
  rowToActivity,
  rowToCertificate,
  rowToEducation,
  rowToExperience,
  rowToProfile,
  rowToProject,
  rowToRole,
  rowToSkill,
  rowToWhyCard,
  skillToLinkRows,
  skillToRow,
  whyCardToRow,
} from "@/lib/data/mappers";

const c = contentSchema.parse(seed);

describe("mappers round-trip", () => {
  it("profile", () => expect(rowToProfile(profileToRow(c.profile))).toEqual(c.profile));
  it.each(c.roles)("role $key", (r) => expect(rowToRole(roleToRow(r))).toEqual(r));
  it.each(c.experiences)("experience $id", (e) =>
    expect(rowToExperience(experienceToRow(e))).toEqual(e),
  );
  it.each(c.projects)("project $id", (p) => expect(rowToProject(projectToRow(p))).toEqual(p));
  it.each(c.certificates)("certificate $id", (x) =>
    expect(rowToCertificate(certificateToRow(x))).toEqual(x),
  );
  it.each(c.activities)("activity $id", (a) => expect(rowToActivity(activityToRow(a))).toEqual(a));
  it.each(c.education)("education $id", (e) =>
    expect(rowToEducation(educationToRow(e))).toEqual(e),
  );
  it.each(c.whyCards)("whyCard $id", (w) => expect(rowToWhyCard(whyCardToRow(w))).toEqual(w));
  it.each(c.skills)("skill $id", (s) => {
    const back = rowToSkill(skillToRow(s), skillToLinkRows(s));
    expect(back).toEqual(s);
  });
});

describe("mappers row shape", () => {
  it("uses snake_case columns", () => {
    const row = experienceToRow(c.experiences[0]);
    expect(row).toHaveProperty("parent_company");
    expect(row).toHaveProperty("sort_index");
    expect(row).toHaveProperty("case_study");
    expect(row).toHaveProperty("employment_type");
  });
  it("maps a why-card stat to the jsonb `stat` column, and a missing column to null", () => {
    const withStat = c.whyCards.find((w) => w.stat);
    expect(withStat).toBeDefined();
    expect(whyCardToRow(withStat!).stat).toEqual(withStat!.stat);
    const { stat: _stat, ...row } = whyCardToRow(c.whyCards[0]);
    void _stat;
    expect(rowToWhyCard(row as ReturnType<typeof whyCardToRow>).stat).toBeNull();
  });
  it("ignores links that belong to other skills", () => {
    const s = c.skills[0];
    const links = [
      { skill_id: s.id, experience_id: "skg-coa", project_id: null },
      { skill_id: "other", experience_id: "skg-intern", project_id: null },
    ];
    expect(rowToSkill(skillToRow(s), links).experienceIds).toEqual(["skg-coa"]);
  });
});
