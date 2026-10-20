// Pushes src/content/seed.json to Supabase with the service-role key from .env.local.
//   npm run db:seed          upsert every table, then print row counts
//   npm run db:seed-sql      print the same snapshot as SQL instead (no credentials needed)
import { contentSchema } from "../src/content/schema";
import seed from "../src/content/seed.json";
import {
  buildSeedRows,
  CONFLICT_KEY,
  renderSeedSql,
} from "../src/lib/data/seed-rows";
import { createServiceSupabase } from "../src/lib/supabase/service";

const rows = buildSeedRows(contentSchema.parse(seed));

if (process.argv.includes("--sql")) {
  process.stdout.write(renderSeedSql(rows));
} else {
  const db = createServiceSupabase();
  for (const [table, list] of Object.entries(rows)) {
    if (table === "skill_links") {
      const { error: del } = await db
        .from(table)
        .delete()
        .not("skill_id", "is", null);
      if (del) throw new Error(`${table}: ${del.message}`);
      const { error } = await db.from(table).insert(list);
      if (error) throw new Error(`${table}: ${error.message}`);
    } else {
      const onConflict = CONFLICT_KEY[table as keyof typeof CONFLICT_KEY];
      const { error } = await db.from(table).upsert(list, { onConflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`${table.padEnd(13)} ${count}`);
  }
}
