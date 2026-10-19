// Reads the site content with the public (anon) key, exactly as visitors do, and compares each
// section with seed.json. Run after `npm run db:seed` to confirm RLS and the mappers agree.
import { isDeepStrictEqual } from "node:util";
import { contentSchema } from "../src/content/schema";
import seed from "../src/content/seed.json";
import { createPublicSupabase, SupabaseRepository } from "../src/lib/data/supabase-repository";

const fromDb = contentSchema.parse(await new SupabaseRepository(createPublicSupabase()).getContent());
const expected = contentSchema.parse(seed);
let differences = 0;
for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
  const same = isDeepStrictEqual(fromDb[key], expected[key]);
  if (!same) differences++;
  console.log(key.padEnd(13), same ? "same" : "DIFFERENT");
}
if (differences) process.exitCode = 1;
