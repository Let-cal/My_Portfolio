// Data for the experience tree migration dry run (scripts/ci/experience-tree-dry-run.mjs):
// the frozen pre-migration content as SQL for the old schema, and the rows expected before
// and after the migration. One moved row gets Code, Demo and Docs links in both, so the
// dry run also exercises the links mapping.
import { contentSchema, type Content } from "../../src/content/schema";
import {
  buildSeedRows,
  renderSeedSql,
  type SeedRows,
} from "../../src/lib/data/seed-rows";

/** Project columns the migration adds; the old schema does not have them. */
export const NEW_PROJECT_COLUMNS = [
  "experience_id",
  "education_id",
  "kind",
  "featured",
  "featured_order",
  "roles",
  "team_size",
  "links",
] as const;

export const LINKS_VARIANT = {
  id: "skg-coa",
  code: "https://example.invalid/coa-code",
  demo: "https://example.invalid/coa-demo",
  other: { label: "Docs", url: "https://example.invalid/coa-docs" },
};

type Row = Record<string, unknown>;

/** The tables and columns the dry run compares (timestamps are left out). */
export type Snapshot = {
  experiences: Row[];
  projects: Row[];
  skill_links: Row[];
  why_cards: Row[];
  roles: Row[];
};

export function snapshotOf(rows: SeedRows): Snapshot {
  return {
    experiences: rows.experiences,
    projects: rows.projects,
    skill_links: rows.skill_links,
    why_cards: rows.why_cards.map((w) => ({
      id: w.id,
      evidence_link: w.evidence_link,
    })),
    roles: rows.roles.map((r) => ({
      key: r.key,
      experience_order: r.experience_order,
    })),
  };
}

function withLinksBefore(c: Content): Content {
  const { id, code, demo, other } = LINKS_VARIANT;
  return {
    ...c,
    experiences: c.experiences.map((e) =>
      e.id === id
        ? {
            ...e,
            links: [
              { label: "Code", url: code },
              { label: "Demo", url: demo },
              other,
            ],
          }
        : e,
    ),
  };
}

function withLinksAfter(c: Content): Content {
  const { id, code, demo, other } = LINKS_VARIANT;
  return {
    ...c,
    projects: c.projects.map((p) =>
      p.id === id
        ? { ...p, repoUrls: [code], demoUrl: demo, links: [other] }
        : p,
    ),
  };
}

/**
 * Text the live database corrected after the frozen pre-migration seed was taken. The migration moves projects but
 * never rewrites these columns, so the dry run expects the frozen text for the projects that exist on both sides.
 */
const CORRECTED_AFTER_FREEZE = [
  "role",
  "summary",
  "tech",
  "demoUrl",
  "repoUrls",
] as const;

export function withFrozenProjectText(
  after: Content,
  before: Content,
): Content {
  const frozen = new Map(before.projects.map((p) => [p.id, p]));
  return {
    ...after,
    projects: after.projects.map((p) => {
      const old = frozen.get(p.id);
      if (!old) return p;
      return {
        ...p,
        ...Object.fromEntries(CORRECTED_AFTER_FREEZE.map((k) => [k, old[k]])),
      };
    }),
  };
}

export type DryRunData = {
  beforeSql: string;
  expectedBefore: Snapshot;
  expectedAfter: Snapshot;
};

/** `before` is the frozen pre-migration seed, `after` the current seed.json. */
export function dryRunData(before: unknown, after: unknown): DryRunData {
  const frozen = contentSchema.parse(before);
  const beforeRows = buildSeedRows(withLinksBefore(frozen));
  const omitted = new Set<string>(NEW_PROJECT_COLUMNS);
  beforeRows.projects = beforeRows.projects.map((p) =>
    Object.fromEntries(Object.entries(p).filter(([k]) => !omitted.has(k))),
  );
  return {
    beforeSql: renderSeedSql(beforeRows, { projects: NEW_PROJECT_COLUMNS }),
    expectedBefore: snapshotOf(beforeRows),
    expectedAfter: snapshotOf(
      buildSeedRows(
        withLinksAfter(
          withFrozenProjectText(contentSchema.parse(after), frozen),
        ),
      ),
    ),
  };
}
