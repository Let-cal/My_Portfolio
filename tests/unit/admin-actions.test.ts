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

/** Records each query; `select ... order` answers with `existing`, writes succeed. */
function table(name: string) {
  const record = (op: string, args: unknown[]) => calls.push({ table: name, op, args });
  const done = { error: null, count: 1 };
  const filterable = (op: string, args: unknown[]) => {
    record(op, args);
    return { eq: (...eqArgs: unknown[]) => (record(`${op}.eq`, eqArgs), Promise.resolve(done)) };
  };
  return {
    select: () => ({
      order: () => Promise.resolve({ data: [...existing].sort((a, b) => b.sort_index - a.sort_index), error: null }),
    }),
    upsert: (...args: unknown[]) => (record("upsert", args), Promise.resolve(done)),
    insert: (...args: unknown[]) => (record("insert", args), Promise.resolve(done)),
    update: (...args: unknown[]) => filterable("update", args),
    delete: (...args: unknown[]) => filterable("delete", args),
  };
}
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from: table }) }));

const { saveResource, deleteResource, reorderResource, togglePublished, saveProfile, saveRole, setOpenToWork } = await import(
  "@/app/admin/actions"
);
const content = contentSchema.parse(seed);

beforeEach(() => {
  calls = [];
  existing = [
    { id: "a", sort_index: 0 },
    { id: "b", sort_index: 4 },
  ];
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
});
