import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { experienceToRow, projectToRow } from "@/lib/data/mappers";
import { STAR_LIMIT_MESSAGE } from "@/lib/featured";

// Stars, the featured order and where a project belongs, as the server actions see them.
const updateTag = vi.fn();
const refresh = vi.fn();
const requireAdmin = vi.fn();
vi.mock("next/cache", () => ({ updateTag, refresh }));
vi.mock("@/lib/admin/session", () => ({ requireAdmin }));
vi.mock("@/lib/admin/access", () => ({ requireContentRead: vi.fn() }));

type Row = Record<string, unknown>;
type Call = { table: string; op: string; args: unknown[] };
let calls: Call[] = [];
let tableRows: Record<string, Row[]> = {};
let deleteError: { message: string; code?: string } | null = null;
/** The next filtered read sees no rows (the data changes between a check and the write). */
let staleRead = false;

function table(name: string) {
  const rows = () => tableRows[name] ?? [];
  const record = (op: string, args: unknown[]) =>
    calls.push({ table: name, op, args });
  const write = (op: string, args: unknown[]) => {
    record(op, args);
    const result = () =>
      op === "delete" && deleteError
        ? { error: deleteError, count: null }
        : { error: null, count: 1 };
    return {
      eq: (...eqArgs: unknown[]) => (
        record(`${op}.eq`, eqArgs),
        Promise.resolve(result())
      ),
    };
  };
  return {
    select: (...args: unknown[]) => {
      record("select", args);
      return {
        order: () =>
          Promise.resolve({
            data: [...rows()].sort(
              (a, b) => Number(a.sort_index) - Number(b.sort_index),
            ),
            error: null,
          }),
        eq: (col: string, value: unknown) => {
          const data = staleRead ? [] : rows().filter((r) => r[col] === value);
          staleRead = false;
          return Promise.resolve({ data, error: null });
        },
      };
    },
    upsert: (...args: unknown[]) => (
      record("upsert", args),
      Promise.resolve({ error: null })
    ),
    insert: (...args: unknown[]) => (
      record("insert", args),
      Promise.resolve({ error: null })
    ),
    update: (...args: unknown[]) => write("update", args),
    delete: (...args: unknown[]) => write("delete", args),
  };
}
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ from: table }),
}));

const {
  toggleFeatured,
  reorderFeatured,
  deleteResource,
  saveResource,
  duplicateResource,
} = await import("@/app/admin/actions");
const content = contentSchema.parse(seed);
const projectRows = () => content.projects.map((p) => ({ ...projectToRow(p) }));
const writes = () =>
  calls.filter((c) => ["update", "upsert", "insert", "delete"].includes(c.op));

beforeEach(() => {
  calls = [];
  deleteError = null;
  staleRead = false;
  tableRows = {
    projects: projectRows(),
    experiences: content.experiences.map((e) => ({ ...experienceToRow(e) })),
  };
  updateTag.mockReset();
  refresh.mockReset();
  requireAdmin.mockReset().mockResolvedValue({ email: "admin@x.com" });
});

describe("toggleFeatured", () => {
  it("4th star refused with the message", async () => {
    // The seed stars the three university projects.
    expect(await toggleFeatured("skg-coa")).toEqual({
      ok: false,
      error: STAR_LIMIT_MESSAGE,
    });
    expect(writes()).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("a star goes to the end of the featured order", async () => {
    tableRows.projects = projectRows().map((r) =>
      r.id === "meet-my-lecturer"
        ? { ...r, featured: false, featured_order: null }
        : r,
    );
    expect(await toggleFeatured("skg-coa")).toEqual({ ok: true });
    expect(writes()).toEqual([
      {
        table: "projects",
        op: "update",
        args: [{ featured: true, featured_order: 3 }],
      },
    ]);
    expect(calls.find((c) => c.op === "update.eq")!.args).toEqual([
      "id",
      "skg-coa",
    ]);
    expect(updateTag).toHaveBeenCalledWith("content");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("removing a star is never refused and clears the order", async () => {
    expect(await toggleFeatured("zodiacgems")).toEqual({ ok: true });
    expect(writes()).toEqual([
      {
        table: "projects",
        op: "update",
        args: [{ featured: false, featured_order: null }],
      },
    ]);
  });

  it("refuses an unknown or malformed id without writing", async () => {
    expect((await toggleFeatured("nope")).ok).toBe(false);
    expect((await toggleFeatured("" as string)).ok).toBe(false);
    expect((await toggleFeatured({ id: "x" } as never)).ok).toBe(false);
    expect(writes()).toEqual([]);
  });
});

describe("reorderFeatured", () => {
  it("reorderFeatured writes featured_order 1..n", async () => {
    expect(
      await reorderFeatured(["meet-my-lecturer", "siteplus", "zodiacgems"]),
    ).toEqual({ ok: true });
    const updates = calls.filter((c) => c.op === "update");
    expect(updates.map((c) => c.args[0])).toEqual([
      { featured_order: 1 },
      { featured_order: 2 },
      { featured_order: 3 },
    ]);
    expect(
      calls.filter((c) => c.op === "update.eq").map((c) => c.args),
    ).toEqual([
      ["id", "meet-my-lecturer"],
      ["id", "siteplus"],
      ["id", "zodiacgems"],
    ]);
    expect(updateTag).toHaveBeenCalledWith("content");
  });

  it("only orders the starred projects: other ids, missing ones or duplicates are refused", async () => {
    for (const ids of [
      ["siteplus", "zodiacgems", "skg-coa"],
      ["siteplus", "zodiacgems"],
      ["siteplus", "zodiacgems", "meet-my-lecturer", "skg-coa"],
      ["siteplus", "siteplus", "zodiacgems"],
    ]) {
      const result = await reorderFeatured(ids);
      expect(result.ok).toBe(false);
    }
    expect((await reorderFeatured("siteplus" as never)).ok).toBe(false);
    expect(writes()).toEqual([]);
  });
});

describe("the read-only reviewer", () => {
  it.each([
    ["toggleFeatured", () => toggleFeatured("skg-coa")],
    ["reorderFeatured", () => reorderFeatured(["siteplus"])],
  ])("reviewer gets FORBIDDEN before any DB call (%s)", async (_n, action) => {
    requireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    const result = await action();
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(calls).toEqual([]);
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("deleting a stint or a school", () => {
  const message = (n: number) =>
    `Còn ${n} dự án thuộc mục này. Chuyển các dự án sang mục khác trước khi xóa.`;

  it("deleting skg-engineer with projects is refused with the count", async () => {
    expect(await deleteResource("experiences", "skg-engineer")).toEqual({
      ok: false,
      error: message(3),
    });
    expect(writes()).toEqual([]);
  });

  it("a school with projects is refused the same way", async () => {
    expect(await deleteResource("education", "fpt-university")).toEqual({
      ok: false,
      error: message(3),
    });
    expect(writes()).toEqual([]);
  });

  it("a stint without projects is deleted", async () => {
    expect(await deleteResource("experiences", "fpt-japan")).toEqual({
      ok: true,
    });
  });

  it("the foreign key refusal (a project moved in meanwhile) gets the same message", async () => {
    deleteError = {
      code: "23503",
      message:
        'update or delete on table "experiences" violates foreign key constraint',
    };
    // The pre-check saw no project; by the time of the delete one belongs here.
    staleRead = true;
    tableRows.projects = projectRows().map((r) =>
      r.id === "skg-coa" ? { ...r, experience_id: "fpt-japan" } : r,
    );
    expect(await deleteResource("experiences", "fpt-japan")).toEqual({
      ok: false,
      error: message(1),
    });
  });
});

describe("saving a project from the form", () => {
  const form = (id: string, patch: Row = {}) => {
    const { sortIndex: _s, ...p } = content.projects.find((x) => x.id === id)!;
    void _s;
    return { ...p, ...patch };
  };

  it("refuses a 4th star on the star switch", async () => {
    const result = await saveResource(
      "projects",
      form("skg-coa", { featured: true }),
      false,
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { featured: STAR_LIMIT_MESSAGE },
    });
    expect(writes()).toEqual([]);
  });

  it("keeps the featured order the server holds, whatever the form sends", async () => {
    await saveResource(
      "projects",
      form("zodiacgems", { featuredOrder: 99 }),
      false,
    );
    const upsert = calls.find((c) => c.op === "upsert")!;
    expect(upsert.args[0]).toMatchObject({
      featured: true,
      featured_order: 2,
    });
    calls = [];
    await saveResource(
      "projects",
      form("skg-coa", { featured: false, featuredOrder: 1 }),
      false,
    );
    expect(calls.find((c) => c.op === "upsert")!.args[0]).toMatchObject({
      featured: false,
      featured_order: null,
    });
  });

  it("reports a kind that does not match where the project belongs on that field", async () => {
    const result = await saveResource(
      "projects",
      form("skg-coa", { kind: "personal" }),
      false,
    );
    expect(result).toMatchObject({ ok: false });
    expect(
      (result as { fieldErrors?: Record<string, string> }).fieldErrors?.kind,
    ).toMatch(/Thuộc về/);
    expect(writes()).toEqual([]);
  });

  it("a duplicated project starts without a star", async () => {
    const result = await duplicateResource("projects", "siteplus");
    expect(result.ok).toBe(true);
    expect(calls.find((c) => c.op === "insert")!.args[0]).toMatchObject({
      featured: false,
      featured_order: null,
      published: false,
    });
  });
});
