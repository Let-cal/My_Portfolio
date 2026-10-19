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
let links: {
  skill_id: string;
  experience_id: string | null;
  project_id: string | null;
}[] = [];
let tableRows: Record<string, Record<string, unknown>[]> = {};

/** Records each query; `select ... order` answers with `existing`, writes succeed. */
function table(name: string) {
  const record = (op: string, args: unknown[]) =>
    calls.push({ table: name, op, args });
  const done = { error: null, count: 1 };
  const filterable = (op: string, args: unknown[]) => {
    record(op, args);
    return {
      eq: (...eqArgs: unknown[]) => (
        record(`${op}.eq`, eqArgs),
        Promise.resolve(done)
      ),
      match: (...matchArgs: unknown[]) => (
        record(`${op}.match`, matchArgs),
        Promise.resolve(done)
      ),
    };
  };
  return {
    select: () => ({
      order: () =>
        Promise.resolve({
          data: [...existing].sort((a, b) => b.sort_index - a.sort_index),
          error: null,
        }),
      eq: (col: string, value: string) => {
        const rows = (
          name === "skill_links" ? links : (tableRows[name] ?? [])
        ) as Record<string, unknown>[];
        return Promise.resolve({
          data: rows.filter((l) => l[col] === value),
          error: null,
        });
      },
    }),
    upsert: (...args: unknown[]) => (
      record("upsert", args),
      Promise.resolve(done)
    ),
    insert: (...args: unknown[]) => (
      record("insert", args),
      Promise.resolve(done)
    ),
    update: (...args: unknown[]) => filterable("update", args),
    delete: (...args: unknown[]) => filterable("delete", args),
  };
}
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ from: table }),
}));

const {
  saveResource,
  deleteResource,
  reorderResource,
  togglePublished,
  saveProfile,
  saveRole,
  setOpenToWork,
  saveSkillLinks,
  duplicateResource,
} = await import("@/app/admin/actions");
const content = contentSchema.parse(seed);

beforeEach(() => {
  calls = [];
  existing = [
    { id: "a", sort_index: 0 },
    { id: "b", sort_index: 4 },
  ];
  links = [];
  tableRows = {};
  updateTag.mockReset();
  requireAdmin.mockReset().mockResolvedValue({ email: "admin@x.com" });
});

describe("admin actions", () => {
  it("refuse to write for anyone who is not the admin", async () => {
    requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    const { sortIndex: _s, ...cert } = content.certificates[0];
    void _s;
    expect(await saveResource("certificates", cert, true)).toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
    expect(calls).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("add a new item at the end of the list and refresh the site cache", async () => {
    const { sortIndex: _s, ...cert } = content.certificates[0];
    void _s;
    const result = await saveResource(
      "certificates",
      { ...cert, id: "new-cert" },
      true,
    );
    expect(result).toEqual({ ok: true });
    const upsert = calls.find((c) => c.op === "upsert")!;
    expect(upsert.args[0]).toMatchObject({
      id: "new-cert",
      sort_index: 5,
      issue_date: cert.issueDate,
    });
    expect(updateTag).toHaveBeenCalledWith("content");
  });

  it("refuse a new item whose id is taken", async () => {
    existing.push({ id: content.certificates[0].id, sort_index: 1 });
    const result = await saveResource(
      "certificates",
      content.certificates[0],
      true,
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        id: `ID "${content.certificates[0].id}" đã được dùng, chọn ID khác`,
      },
    });
  });

  it("report validation problems instead of writing", async () => {
    const cert = content.certificates[0];
    const result = await saveResource(
      "certificates",
      {
        ...cert,
        id: "a",
        issueDate: "soon",
        description: { en: "", ja: "", vi: "" },
      },
      false,
    );
    expect(result).toMatchObject({
      ok: false,
      error: "Có 2 mục cần sửa",
      fieldErrors: {
        issueDate: "Ngày cấp phải có dạng ngày/tháng/năm",
        "description.en": "Nhập mô tả (EN)",
      },
    });
    expect(calls.some((c) => c.op === "upsert")).toBe(false);
  });

  it("replace a skill's evidence links when it is saved", async () => {
    const skill = content.skills.find((s) => s.experienceIds.length)!;
    existing.push({ id: skill.id, sort_index: 2 });
    await saveResource("skills", skill, false);
    expect(calls.find((c) => c.op === "delete.eq")).toMatchObject({
      table: "skill_links",
      args: ["skill_id", skill.id],
    });
    const insert = calls.find((c) => c.op === "insert")!;
    expect(insert.args[0]).toHaveLength(
      skill.experienceIds.length + skill.projectIds.length,
    );
  });

  it("save a new order as positions", async () => {
    await reorderResource("projects", ["b", "a"]);
    const updates = calls
      .filter((c) => c.op === "update")
      .map((c) => c.args[0]);
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
    expect(upsert.args[0]).toMatchObject({
      id: "me",
      name: content.profile.name,
    });
    calls = [];
    expect(
      (await saveProfile({ ...content.profile, phone: "0123456789" })).ok,
    ).toBe(false);
    expect(calls).toEqual([]);
  });

  it("save a role by its key and switch open to work", async () => {
    expect(await saveRole(content.roles[0])).toEqual({ ok: true });
    const upsert = calls.find((c) => c.op === "upsert")!;
    expect(upsert.table).toBe("roles");
    expect(upsert.args[0]).toMatchObject({ key: content.roles[0].key });
    expect(await setOpenToWork(false)).toEqual({ ok: true });
    expect(calls.find((c) => c.op === "update")).toMatchObject({
      table: "profile",
      args: [{ open_to_work: false }],
    });
    expect(updateTag).toHaveBeenCalledTimes(2);
  });

  it("saveSkillLinks applies a batch of changes and refreshes the site once", async () => {
    const result = await saveSkillLinks([
      { skillId: "react", projectId: "siteplus", linked: true },
      { skillId: "gsap", experienceId: "skg-coa", linked: true },
      { skillId: "dart", projectId: "zodiacgems", linked: false },
    ]);
    expect(result).toEqual({ ok: true });
    const upsert = calls.find((c) => c.op === "upsert")!;
    expect(upsert.table).toBe("skill_links");
    expect(upsert.args).toEqual([
      [
        { skill_id: "react", experience_id: null, project_id: "siteplus" },
        { skill_id: "gsap", experience_id: "skg-coa", project_id: null },
      ],
      {
        onConflict: "skill_id,experience_id,project_id",
        ignoreDuplicates: true,
      },
    ]);
    expect(
      calls.filter((c) => c.op === "delete.match").map((c) => c.args[0]),
    ).toEqual([{ skill_id: "dart", project_id: "zodiacgems" }]);
    expect(updateTag).toHaveBeenCalledTimes(1);
  });

  it("saveSkillLinks refuses non-admins and malformed changes", async () => {
    requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    expect(
      (
        await saveSkillLinks([
          { skillId: "react", projectId: "siteplus", linked: true },
        ])
      ).ok,
    ).toBe(false);
    requireAdmin.mockResolvedValue({ email: "admin@x.com" });
    const bad = [
      {
        skillId: "react",
        projectId: "siteplus",
        experienceId: "skg-coa",
        linked: true,
      },
    ];
    expect((await saveSkillLinks(bad as never)).ok).toBe(false);
    expect(
      (await saveSkillLinks([{ skillId: "", projectId: "x", linked: true }]))
        .ok,
    ).toBe(false);
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
    expect(
      await saveResource(
        "projects",
        { ...data, skillIds: ["react", "dart"] },
        false,
      ),
    ).toEqual({ ok: true });
    const projectUpsert = calls.find(
      (c) => c.op === "upsert" && c.table === "projects",
    )!;
    expect(projectUpsert.args[0]).not.toHaveProperty("skillIds");
    expect(
      calls
        .filter((c) => c.table === "skill_links" && c.op === "insert")
        .map((c) => c.args[0]),
    ).toEqual([
      [{ skill_id: "dart", experience_id: null, project_id: "siteplus" }],
    ]);
    expect(
      calls.filter((c) => c.op === "delete.match").map((c) => c.args[0]),
    ).toEqual([{ skill_id: "flutter", project_id: "siteplus" }]);
  });

  it("duplicate a certificate as a hidden copy at the end", async () => {
    existing.push(
      { id: "ielts", sort_index: 2 },
      { id: "ielts-copy", sort_index: 3 },
    );
    tableRows.certificates = [
      {
        id: "ielts",
        name: "IELTS",
        published: true,
        sort_index: 2,
        created_at: "x",
        updated_at: "y",
      },
    ];
    const result = await duplicateResource("certificates", "ielts");
    expect(result).toEqual({ ok: true, id: "ielts-copy-2" });
    const insert = calls.find(
      (c) => c.op === "insert" && c.table === "certificates",
    )!;
    expect(insert.args[0]).toEqual({
      id: "ielts-copy-2",
      name: "IELTS",
      published: false,
      sort_index: 5,
    });
    expect(updateTag).toHaveBeenCalledWith("content");
  });

  it("duplicate a skill together with its evidence links", async () => {
    tableRows.skills = [
      { id: "react", name: "React", skill_group: "frameworks", sort_index: 0 },
    ];
    links = [
      { skill_id: "react", experience_id: null, project_id: "siteplus" },
    ];
    expect(await duplicateResource("skills", "react")).toEqual({
      ok: true,
      id: "react-copy",
    });
    expect(
      calls.find((c) => c.op === "insert" && c.table === "skill_links")!
        .args[0],
    ).toEqual([
      { skill_id: "react-copy", experience_id: null, project_id: "siteplus" },
    ]);
  });

  it("duplicate refuses non-admins", async () => {
    requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    expect((await duplicateResource("certificates", "ielts")).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});
