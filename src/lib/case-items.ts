import type { CaseStudyItem } from "@/components/sections/case-study/CaseStudyPanel";
import type { ArchiveRow } from "@/lib/archive";
import type { JourneyParent } from "@/lib/journey";

/** The case study panel item of an archive row (also used for the home bento); null without a case study. */
export function caseItemFromRow(
  row: ArchiveRow,
  kindLabel: string,
): CaseStudyItem | null {
  return row.caseStudy
    ? {
        id: row.id,
        title: row.title,
        where: row.where,
        stint: row.stintLabel,
        role: row.role,
        teamSize: row.teamSize,
        period: row.period,
        duration: row.duration,
        kindLabel,
        caseStudy: row.caseStudy,
        tech: row.tech,
        demoUrl: row.demoUrl,
        repoUrls: row.repoUrls,
      }
    : null;
}

/**
 * The tree's panel items in reading order: parents top to bottom, a company's projects stint by stint (newest
 * stint first), a school's in its own order. Only children with a case study take part.
 */
export function caseItemsFromJourney(
  parents: JourneyParent[],
  kindLabel: (kind: JourneyParent["kind"]) => string,
): CaseStudyItem[] {
  return parents.flatMap((parent) => {
    const groups =
      parent.stints.length > 0
        ? parent.stints
        : [{ shortLabel: "", children: parent.children }];
    return groups.flatMap((stint) =>
      stint.children.flatMap((c) =>
        c.caseStudy
          ? [
              {
                id: c.id,
                title: c.title,
                where: parent.name,
                stint: stint.shortLabel || null,
                role: c.role,
                teamSize: c.teamSize,
                period: c.period,
                duration: c.duration,
                kindLabel: kindLabel(parent.kind),
                caseStudy: c.caseStudy,
                tech: c.tech,
                demoUrl: c.demoUrl,
                repoUrls: c.repoUrls,
              },
            ]
          : [],
      ),
    );
  });
}
