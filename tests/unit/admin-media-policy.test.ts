import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_MEDIA_SELECT_SQL, renderSchemaSql } from "@/lib/data/schema-sql";

const expectedPolicy =
  "create policy \"admin_media_select\" on storage.objects for select to authenticated using (bucket_id in ('media', 'files') and private.is_admin());";

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

  it("renders exactly one storage SELECT policy without public listing", () => {
    const policies = executableSql(renderSchemaSql()).match(
      /create policy [^;]+ on storage\.objects for (?:select|all)\b[^;]*;/g,
    );
    expect(policies).toEqual([expectedPolicy]);
    expect(renderSchemaSql()).toContain(ADMIN_MEDIA_SELECT_SQL);
  });

  it("the migration adds only this policy and matches the canonical export", () => {
    const migration = executableSql(
      readFileSync(
        "supabase/migrations/20261021124334_admin_media_select.sql",
        "utf8",
      ),
    );
    expect(migration).toBe(expectedPolicy);
    expect(migration).toBe(executableSql(ADMIN_MEDIA_SELECT_SQL));
  });
});
