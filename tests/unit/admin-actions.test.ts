import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";

const updateTag = vi.fn();
const requireAdmin = vi.fn();
vi.mock("next/cache", () => ({ updateTag }));
vi.mock("@/lib/admin/session", () => ({ requireAdmin }));

type Call = { table: string; op: string; args: unknown[] };
let calls: Call[] = [];
let existing: { id: string; sort_index: number }[] = [];
let links: { skill_id: string; experience_id: string | null; project_id: string | null }[] = [];

/** Records each query; `select ... order` answers with `existing`, writes succeed. */
function table(name: string) {
  const record = (op: string, args: unknown[]) => calls.push({ table: name, op, args });
  const done = { error: null, count: 1 };
  const filterable = (op: string, args: unknown[]) => {
    record(op, args);
    return {
      eq: (...eqArgs: unknown[]) => (record(`${op}.eq`, eqArgs), Promise.resolve(done)),
      match: (...matchArgs: unknown[]) => (record(`${op}.match`, matchArgs), Promise.resolve(done)),
    };
  };
  return {
    select: () => ({
      order: () => Promise.resolve({ data: [...existing].sort((a, b) => b.sort_index - a.sort_index), error: null }),
      eq: (col: string, value: string) =>
        Promise.resolve({ data: links.filter((l) => l[col as keyof (typeof links)[number]] === value), error: null }),
    }),
    upsert: (...args: unknown[]) => (record("upsert", args), Promise.resolve(done)),
    insert: (...args: unknown[]) => (record("insert", args), Promise.resolve(done)),
    update: (...args: unknown[]) => filterable("update", args),
    delete: (...args: unknown[]) => filterable("delete", args),
  };
}
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from: table }) }));

const {
  saveResource,
  deleteResource,
  reorderResource,
  togglePublished,
  saveProfile,
  saveRole,
  setOpenToWork,
  setSkillLink,
  flushContent,
} = await import("@/app/admin/actions");
const content = contentSchema.parse(seed);

beforeEach(() => {
  calls = [];
  existing = [
    { id: "a", sort_index: 0 },
    { id: "b", sort_index: 4 },
  ];
  links = [];
  updateTag.mockReset();
  requireAdmin.mockReset().mockResolvedValue({ email: "admin@x.com" });
});

describe("admin actions", () => {
  it("refuse to write for anyone who is not the admin", async () => {
    requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    const { sortIndex: _s, ...cert } = content.certificates[0];
    void _s;
    expect(await saveResource("certificates", cert, true)).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(calls).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("add a new item at the end of the list and refresh the site cache", async () => {
    const { sortIndex: _s, ...cert } = content.certificates[0];
    void _s;
    const result = await saveResource("certificates", { ...cert, id: "new-cert" }, true);
    expect(result).toEqual({ ok: true });
    const upsert = calls.find((c) => c.op === "upsert")!;
    expect(upsert.args[0]).toMatchObject({ id: "new-cert", sort_index: 5, issue_date: cert.issueDate });
    expect(updateTag).toHaveBeenCalledWith("content");
  });

  it("refuse a new item whose id is taken", async () => {
    existing.push({ id: content.certificates[0].id, sort_index: 1 });
    const result = await saveResource("certificates", content.certificates[0], true);
    expect(result.ok).toBe(false);
  });

  it("report validation problems instead of writing", async () => {
    const result = await saveResource("certificates", { ...content.certificates[0], id: "a", issueDate: "soon" }, false);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("issueDate") });
    expect(calls.some((c) => c.op === "upsert")).toBe(false);
  });

  it("replace a skill's evidence links when it is saved", async () => {
    const skill = content.skills.find((s) => s.experienceIds.length)!;
    existing.push({ id: skill.id, sort_index: 2 });
    await saveResource("skills", skill, false);
    expect(calls.find((c) => c.op === "delete.eq")).toMatchObject({ table: "skill_links", args: ["skill_id", skill.id] });
    const insert = calls.find((c) => c.op === "insert")!;
    expect(insert.args[0]).toHaveLength(skill.experienceIds.length + skill.projectIds.length);
  });

  it("save a new order as positions", async () => {
    await reorderResource("projects", ["b", "a"]);
    const updates = calls.filter((c) => c.op === "update").map((c) => c.args[0]);
    expect(updates).toEqual([{ sort_index: 0 }, { sort_index: 1 }]);
  });

  it("toggle visibility only where visitors can hide rows", async () => {
    expect((await togglePublished("projects", "a", false)).ok).toBe(true);
    expect((await togglePublished("skills", "a", false)).ok).toBe(false);
  });

  it("reject unknown resources", async () => {
    expect((await deleteResource("profile", "me")).ok).toBe(false);
  });

  it("save the profile as the single 'me' row and refuse a phone number", async () => {
    expect(await saveProfile(content.profile)).toEqual({ ok: true });
    const upsert = calls.find((c) => c.op === "upsert")!;
    expect(upsert.table).toBe("profile");
    expect(upsert.args[0]).toMatchObject({ id: "me", name: content.profile.name });
    calls = [];
    expect((await saveProfile({ ...content.profile, phone: "0123456789" })).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it("save a role by its key and switch open to work", async () => {
    expect(await saveRole(content.roles[0])).toEqual({ ok: true });
    const upsert = calls.find((c) => c.op === "upsert")!;
    expect(upsert.table).toBe("roles");
    expect(upsert.args[0]).toMatchObject({ key: content.roles[0].key });
    expect(await setOpenToWork(false)).toEqual({ ok: true });
    expect(calls.find((c) => c.op === "update")).toMatchObject({ table: "profile", args: [{ open_to_work: false }] });
    expect(updateTag).toHaveBeenCalledTimes(2);
  });

  it("setSkillLink links with an idempotent upsert and leaves the cache refresh to flushContent", async () => {
    expect(await setSkillLink("react", { experienceId: "skg-coa" }, true)).toEqual({ ok: true });
    const upsert = calls.find((c) => c.op === "upsert")!;
    expect(upsert.table).toBe("skill_links");
    expect(upsert.args).toEqual([
      { skill_id: "react", experience_id: "skg-coa", project_id: null },
      { onConflict: "skill_id,experience_id,project_id", ignoreDuplicates: true },
    ]);
    expect(updateTag).not.toHaveBeenCalled();
    expect(await flushContent()).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith("content");
  });

  it("toggling twice is idempotent", async () => {
    await setSkillLink("react", { projectId: "siteplus" }, true);
    expect(await setSkillLink("react", { projectId: "siteplus" }, true)).toEqual({ ok: true });
    expect(calls.filter((c) => c.op === "upsert")).toHaveLength(2);
  });

  it("unlinking deletes exactly that row", async () => {
    await setSkillLink("react", { projectId: "siteplus" }, false);
    await setSkillLink("react", { experienceId: "skg-coa" }, false);
    expect(calls.filter((c) => c.op === "delete.match").map((c) => c.args[0])).toEqual([
      { skill_id: "react", project_id: "siteplus" },
      { skill_id: "react", experience_id: "skg-coa" },
    ]);
  });

  it("setSkillLink and flushContent refuse non-admins", async () => {
    requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    expect((await setSkillLink("react", { projectId: "siteplus" }, true)).ok).toBe(false);
    expect((await flushContent()).ok).toBe(false);
    expect(calls).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("saving a project's skills only touches that project's links", async () => {
    const project = content.projects.find((p) => p.id === "siteplus")!;
    existing.push({ id: "siteplus", sort_index: 0 });
    links = [
      { skill_id: "react", experience_id: null, project_id: "siteplus" },
      { skill_id: "flutter", experience_id: null, project_id: "siteplus" },
      { skill_id: "react", experience_id: "skg-coa", project_id: null },
    ];
    const { sortIndex: _s, ...data } = project;
    void _s;
    expect(await saveResource("projects", { ...data, skillIds: ["react", "dart"] }, false)).toEqual({ ok: true });
    const projectUpsert = calls.find((c) => c.op === "upsert" && c.table === "projects")!;
    expect(projectUpsert.args[0]).not.toHaveProperty("skillIds");
    expect(calls.filter((c) => c.table === "skill_links" && c.op === "insert").map((c) => c.args[0])).toEqual([
      [{ skill_id: "dart", experience_id: null, project_id: "siteplus" }],
    ]);
    expect(calls.filter((c) => c.op === "delete.match").map((c) => c.args[0])).toEqual([
      { skill_id: "flutter", project_id: "siteplus" },
    ]);
  });
});
