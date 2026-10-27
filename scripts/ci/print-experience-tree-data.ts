// Prints the experience tree dry-run data as JSON (run with tsx by run-admin-integration.mjs).
import seed from "../../src/content/seed.json";
import before from "../../tests/fixtures/seed-before-experience-tree.json";
import { dryRunData } from "./experience-tree-data";

process.stdout.write(JSON.stringify(dryRunData(before, seed)));
