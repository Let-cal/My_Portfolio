import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_MEDIA_SELECT_SQL, renderSchemaSql } from "@/lib/data/schema-sql";

const expectedPolicy =
  "create policy \"admin_media_select\" on storage.objects for select to authenticated using (bucket_id in ('media', 'files') and private.is_admin());";

// Task 5: the read-only reviewer may list the same buckets; still nothing for anon/public.
const reviewerPolicy =
  "create policy \"reviewer_media_select\" on storage.objects for select to authenticated using (bucket_id in ('media', 'files') and private.is_reviewer());";

function executableSql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("admin media SELECT policy", () => {
  it("exports only authenticated admin SELECT for the media and files buckets", () => {
    expect(ADMIN_MEDIA_SELECT_SQL).toBeTypeOf("string");
    expect(executableSql(ADMIN_MEDIA_SELECT_SQL)).toBe(expectedPolicy);
  });

  it("renders only the admin and read-only reviewer SELECT policies, never public listing", () => {
    const policies = executableSql(renderSchemaSql()).match(
      /create policy [^;]+ on storage\.objects for (?:select|all)\b[^;]*;/g,
    );
    expect(policies).toEqual([expectedPolicy, reviewerPolicy]);
    expect(renderSchemaSql()).toContain(ADMIN_MEDIA_SELECT_SQL);
  });

  it("the migration adds only this policy and matches the canonical export", () => {
    const migration = executableSql(
      readFileSync(
        "supabase/migrations/20261021141852_admin_media_select.sql",
        "utf8",
      ),
    );
    expect(migration).toBe(expectedPolicy);
    expect(migration).toBe(executableSql(ADMIN_MEDIA_SELECT_SQL));
  });
});
