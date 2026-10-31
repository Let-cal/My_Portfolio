import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  DRY_RUN_DATABASE,
  HISTORY_SQL,
  RESTORE_CHECK_SQL,
  ROLLBACK_FILE,
  SNAPSHOT_SQL,
  STUBS_SQL,
  diffSnapshots,
  runExperienceTreeDryRun,
  splitMigrations,
} from "../../scripts/ci/experience-tree-dry-run.mjs";

const root = new URL("../../", import.meta.url);
const migrations = readdirSync(new URL("supabase/migrations/", root));

const snapshot = (overrides = {}) => ({
  experiences: [{ id: "skg-intern", company: "SKG", tech: ["a", "b"] }],
  projects: [
    { id: "siteplus", role: { en: "Lead", ja: "L" }, kind: "university" },
  ],
  skill_links: [
    { skill_id: "react", experience_id: null, project_id: "siteplus" },
  ],
  why_cards: [{ id: "card", evidence_link: "#tree-skg-coa" }],
  roles: [{ key: "pm", experience_order: ["skg-engineer", "skg-intern"] }],
  ...overrides,
});

test("the experience tree migration is replayed after every earlier one", () => {
  const { previous, target } = splitMigrations(migrations);
  assert.match(target, /^\d{14}_experience_tree_projects\.sql$/);
  assert.ok(previous.length >= 8);
  assert.deepEqual(previous, [...previous].sort());
  assert.ok(previous.every((f) => f < target));
  assert.throws(
    () => splitMigrations(previous),
    /one experience tree migration/,
  );
});

test("same rows in another key order, with timestamps, are no difference", () => {
  const actual = snapshot({
    projects: [
      {
        kind: "university",
        role: { ja: "L", en: "Lead" },
        id: "siteplus",
        created_at: "x",
        updated_at: "y",
      },
    ],
  });
  assert.deepEqual(diffSnapshots(snapshot(), actual), []);
});

test("differences name table, key and column, never the values", () => {
  const actual = snapshot({
    experiences: [{ id: "skg-intern", company: "Secret Co", tech: ["b", "a"] }],
    projects: [
      {
        id: "siteplus",
        role: { en: "Lead", ja: "L" },
        kind: "university",
        featured: true,
      },
    ],
    skill_links: [
      { skill_id: "react", experience_id: "skg-coa", project_id: null },
    ],
    why_cards: [],
    roles: [
      { key: "pm", experience_order: ["skg-engineer", "skg-intern"] },
      { key: "x", experience_order: [] },
    ],
  });
  const differences = diffSnapshots(snapshot(), actual);
  assert.deepEqual(differences, [
    "experiences/skg-intern.company",
    "experiences/skg-intern.tech",
    "projects/siteplus.featured: unexpected column",
    "skill_links/react||siteplus: missing",
    "skill_links/react|skg-coa|: unexpected",
    "why_cards/card: missing",
    "roles/x: unexpected",
  ]);
  assert.ok(!differences.join(" ").includes("Secret"));
});

test("a column the database lost is reported", () => {
  const actual = snapshot({
    projects: [{ id: "siteplus", role: { en: "Lead", ja: "L" } }],
  });
  assert.deepEqual(diffSnapshots(snapshot(), actual), [
    "projects/siteplus.kind: missing column",
  ]);
});

function fakeRun({ snapshots, failOn } = {}) {
  const calls = [];
  const queue = [...(snapshots ?? [])];
  const result = runExperienceTreeDryRun({
    psql: (sql, database) => {
      calls.push({ sql, database });
      if (failOn && sql.includes(failOn)) throw new Error("psql failed");
      return sql === SNAPSHOT_SQL ? JSON.stringify(queue.shift()) : "";
    },
    read: (path) => `-- ${path}`,
    migrationFiles: [
      "20260101000000_init.sql",
      "20260102000000_experience_tree_projects.sql",
      "20260101000001_next.sql",
    ],
    data: {
      beforeSql: "-- fixture",
      expectedBefore: snapshot(),
      expectedAfter: snapshot({ why_cards: [] }),
    },
  });
  return { result, calls };
}

test("runs every stage in order and drops the scratch database", () => {
  const before = snapshot();
  const after = snapshot({ why_cards: [] });
  const { result, calls } = fakeRun({
    snapshots: [before, before, after, after, before],
  });
  assert.deepEqual(result, {
    status: "PASS",
    stage: "complete",
    differences: [],
  });
  const scripts = calls.map((c) => c.sql);
  const at = (needle) => scripts.findIndex((s) => s.includes(needle));
  const order = [
    "create database experience_tree_dry_run",
    "create schema auth",
    "-- supabase/migrations/20260101000000_init.sql",
    "-- supabase/migrations/20260101000001_next.sql",
    "-- fixture",
    "(draft)",
    "-- supabase/migrations/20260102000000_experience_tree_projects.sql",
    "admin_restore_version",
    `-- ${ROLLBACK_FILE}`,
  ].map(at);
  assert.ok(order.every((i) => i >= 0));
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  assert.equal(scripts.filter((s) => s === SNAPSHOT_SQL).length, 5);
  assert.match(
    scripts.at(-1),
    /^drop database if exists experience_tree_dry_run with \(force\);/,
  );
  assert.equal(calls.at(-1).database, "postgres");
  assert.ok(calls.slice(1, -1).every((c) => c.database === DRY_RUN_DATABASE));
});

test("a difference after the migration fails at that stage with the labels", () => {
  const before = snapshot();
  const { result, calls } = fakeRun({ snapshots: [before, before, before] });
  assert.equal(result.status, "FAIL");
  assert.equal(result.stage, "migration-compare");
  assert.deepEqual(result.differences, ["why_cards/card: unexpected"]);
  assert.match(calls.at(-1).sql, /^drop database/);
});

test("a failing script stops the run at its stage and still cleans up", () => {
  const { result, calls } = fakeRun({
    snapshots: [snapshot(), snapshot()],
    failOn: "experience_tree_projects.sql",
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.stage, "migration");
  assert.match(calls.at(-1).sql, /^drop database/);
});

test("stubs cover every auth, storage and realtime object the migrations use", () => {
  const used = new Set();
  for (const file of migrations) {
    // Comments may name files such as docs/admin-media-storage.sql.
    const sql = readFileSync(
      new URL(`supabase/migrations/${file}`, root),
      "utf8",
    ).replace(/--.*$/gm, "");
    for (const [, name] of sql.matchAll(/\b((?:auth|storage|realtime)\.\w+)/g))
      used.add(name);
  }
  assert.ok(used.size >= 6);
  for (const name of used) assert.ok(STUBS_SQL.includes(name), name);
});

test("the restore check acts as the admin and covers the five moved rows", () => {
  assert.match(RESTORE_CHECK_SQL, /insert into private\.app_admins/);
  assert.match(RESTORE_CHECK_SQL, /request\.jwt\.claims/);
  assert.match(RESTORE_CHECK_SQL, /not \(old_row \? 'kind'\)/);
  assert.match(RESTORE_CHECK_SQL, /exception when sqlstate '22023'/);
  for (const id of [
    "skg-ai-agent",
    "skg-flexybox-p2",
    "skg-coa",
    "skg-flexybox-p1",
    "skg-intern",
  ])
    assert.ok(RESTORE_CHECK_SQL.includes(`'${id}'`), id);
});

test("the launcher runs the dry run after the migration replay and before seeding", () => {
  const source = readFileSync(
    new URL("scripts/ci/run-admin-integration.mjs", root),
    "utf8",
  );
  const replay = source.indexOf(
    "Empty database migration replay did not match committed history",
  );
  const dryRun = source.indexOf(
    "report.experienceTreeDryRun = runExperienceTreeDryRun(",
  );
  const seed = source.indexOf("await seedAdmin(");
  assert.ok(replay > -1 && dryRun > replay && seed > dryRun);
  assert.ok(
    source.includes(
      'throw new Error("Experience tree migration dry run failed")',
    ),
  );
});

test("history gets versions without the new columns and the data ends unchanged", () => {
  assert.match(
    HISTORY_SQL,
    /set title = title \|\| ' \(draft\)' where id = 'siteplus'/,
  );
  assert.match(
    HISTORY_SQL,
    /set title = left\(title, -length\(' \(draft\)'\)\) where id = 'siteplus'/,
  );
  // The restore check takes the oldest of those versions: the original title.
  assert.match(RESTORE_CHECK_SQL, /order by id asc limit 1;/);
});
