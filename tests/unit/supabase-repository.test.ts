import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { buildSeedRows } from "@/lib/data/seed-rows";
import { SupabaseRepository } from "@/lib/data/supabase-repository";

const expected = contentSchema.parse(seed);
const rows = buildSeedRows(expected);

/** A client that answers like PostgREST: `order('sort_index')` sorts, ties keep insertion order. */
function fakeClient(shuffle: boolean): SupabaseClient {
  return {
    from(table: keyof typeof rows) {
      const list = shuffle ? [...rows[table]].reverse() : rows[table];
      const result = { data: list, error: null };
      return {
        select: () =>
          Object.assign(Promise.resolve(result), {
            order: (col: string) =>
              Promise.resolve({
                data: [...list].sort((a, b) => Number(a[col]) - Number(b[col])),
                error: null,
              }),
          }),
      };
    },
  } as unknown as SupabaseClient;
}

describe("SupabaseRepository", () => {
  it("rebuilds the seed content from its rows", async () => {
    expect(
      await new SupabaseRepository(fakeClient(false)).getContent(),
    ).toEqual(expected);
  });

  it("orders skills by group, then position, whatever order the database returns", async () => {
    const content = await new SupabaseRepository(fakeClient(true)).getContent();
    expect(content.skills.map((s) => s.id)).toEqual(
      expected.skills.map((s) => s.id),
    );
  });
});
