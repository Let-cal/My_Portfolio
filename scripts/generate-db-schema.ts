// Writes supabase/schema.sql (the current schema) from src/lib/data/columns.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { renderSchemaSql } from "../src/lib/data/schema-sql";

mkdirSync("supabase", { recursive: true });
writeFileSync("supabase/schema.sql", renderSchemaSql());
console.log("Wrote supabase/schema.sql");
