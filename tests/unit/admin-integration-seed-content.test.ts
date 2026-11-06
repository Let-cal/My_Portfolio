import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contentSchema } from "@/content/schema";
import { archiveRows } from "@/lib/archive";
import { loadContentWithSource } from "@/lib/data/get-content";
import { SupabaseRepository } from "@/lib/data/supabase-repository";
import {
  FIGURES_PROJECT_ID,
  syntheticRows,
} from "../../scripts/ci/seed-admin.mjs";

// The disposable-DB job's public site reads only the synthetic seed. If that content
// failed contentSchema, the site would silently fall back to seed.json, and the figures
// scenario's archive check would look at the wrong data. These tests keep the seed valid.

/** A stand-in for the anon client: each table answers with the seeded rows anon may read. */
function fakeClient(tables: Record<string, Record<string, unknown>[]>) {
  return {
    from(table: string) {
      const rows = (tables[table] ?? []).filter(
        (row) => !("published" in row) || row.published === true,
      );
      const result = Promise.resolve({ data: rows, error: null });
      return {
        select: () =>
          Object.assign(result, { order: () => Promise.resolve(result) }),
      };
    },
  } as unknown as SupabaseClient;
}

describe("disposable admin seed as public content", () => {
  const tables = syntheticRows() as unknown as Record<
    string,
    Record<string, unknown>[] | Record<string, unknown>
  >;
  const asTables = Object.fromEntries(
    Object.entries(tables).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]),
  );

  it("parses as site content, so the public site does not fall back to the seed file", async () => {
    const { content, source } = await loadContentWithSource(
      { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321" },
      () => new SupabaseRepository(fakeClient(asTables)),
    );
    expect(source).toBe("supabase");
    expect(contentSchema.safeParse(content).success).toBe(true);
  });

  it("puts the figures fixture project on the archive with no figures yet", async () => {
    const content = await new SupabaseRepository(
      fakeClient(asTables),
    ).getContent();
    const rows = archiveRows(content, "en", new Date("2026-11-01"));
    expect(rows.map((r) => [r.id, r.figures.length])).toEqual([
      [FIGURES_PROJECT_ID, 0],
    ]);
  });
});
