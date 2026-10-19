// Content health checks for the admin dashboard. Pure functions over the full content,
// hidden items included, so they can be unit-tested against the seed.
import type { Content, Skill } from "@/content/schema";

export type AdminContent = Content;

export type HealthKind =
  | "orphan-skill"
  | "link-to-hidden"
  | "missing-translation"
  | "broken-evidence"
  | "missing-cv"
  | "stale-order"
  | "hidden-items"
  | "empty-case-study";

export type HealthIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  kind: HealthKind;
  message: string;
  href: string;
  count?: number;
};

const RANK = { error: 0, warning: 1, info: 2 } as const;

function isI18nLeaf(v: unknown): v is { en: string; ja: string; vi: string } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.en === "string" && typeof o.ja === "string" && typeof o.vi === "string";
}

/** Counts translated texts that have English, and how many of those also have JA / VI. */
export function translationStats(value: unknown): { total: number; ja: number; vi: number } {
  const acc = { total: 0, ja: 0, vi: 0 };
  const walk = (v: unknown) => {
    if (isI18nLeaf(v)) {
      if (!v.en.trim()) return;
      acc.total++;
      if (v.ja.trim()) acc.ja++;
      if (v.vi.trim()) acc.vi++;
      return;
    }
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return acc;
}

/** Evidence items behind a skill, split by whether visitors can see them. */
export function evidenceOf(skill: Skill, c: AdminContent): { visible: number; hidden: number } {
  const items = [
    ...skill.experienceIds.map((id) => c.experiences.find((e) => e.id === id)),
    ...skill.projectIds.map((id) => c.projects.find((p) => p.id === id)),
  ].filter((x) => x !== undefined);
  const visible = items.filter((x) => x.published).length;
  return { visible, hidden: items.length - visible };
}

type Labeled = { href: string; label: string; value: unknown };

function translatableItems(c: AdminContent): Labeled[] {
  return [
    { href: "/admin/profile", label: "Hồ sơ", value: c.profile },
    ...c.roles.map((r) => ({ href: "/admin/roles", label: `Vai trò ${r.title.en}`, value: r })),
    ...c.experiences.map((e) => ({ href: `/admin/experiences/${e.id}`, label: `Kinh nghiệm ${e.company}`, value: e })),
    ...c.projects.map((p) => ({ href: `/admin/projects/${p.id}`, label: `Dự án ${p.title}`, value: p })),
    ...c.certificates.map((x) => ({ href: `/admin/certificates/${x.id}`, label: `Chứng chỉ ${x.name}`, value: x })),
    ...c.activities.map((a) => ({ href: `/admin/activities/${a.id}`, label: `Hoạt động ${a.name.en}`, value: a })),
    ...c.education.map((e) => ({ href: `/admin/education/${e.id}`, label: `Học vấn ${e.school}`, value: e })),
    ...c.whyCards.map((w) => ({ href: `/admin/why_cards/${w.id}`, label: `Why card ${w.title.en}`, value: w })),
  ];
}

export function checkContentHealth(c: AdminContent): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const evidence = c.skills.map((s) => ({ skill: s, ...evidenceOf(s, c) }));
  const orphans = evidence.filter((e) => e.visible === 0 && e.hidden === 0);
  if (orphans.length) {
    issues.push({
      id: "orphan-skill",
      severity: "warning",
      kind: "orphan-skill",
      count: orphans.length,
      message: `${orphans.length} skill chưa gắn kinh nghiệm hoặc dự án nào`,
      href: "/admin/skills?filter=orphan",
    });
  }
  const hiddenOnly = evidence.filter((e) => e.visible === 0 && e.hidden > 0);
  if (hiddenOnly.length) {
    issues.push({
      id: "link-to-hidden",
      severity: "warning",
      kind: "link-to-hidden",
      count: hiddenOnly.length,
      message: `${hiddenOnly.length} skill chỉ có bằng chứng là mục đang ẩn, nên trên trang coi như chưa có`,
      href: "/admin/skills?filter=hidden-evidence",
    });
  }

  for (const item of translatableItems(c)) {
    const s = translationStats(item.value);
    const ja = s.total - s.ja;
    const vi = s.total - s.vi;
    if (!ja && !vi) continue;
    const parts = [ja && `JA (${ja})`, vi && `VI (${vi})`].filter(Boolean).join(", ");
    issues.push({
      id: `missing-translation:${item.href}:${item.label}`,
      severity: "warning",
      kind: "missing-translation",
      message: `${item.label}: thiếu ${parts}`,
      href: item.href,
    });
  }

  const visibleAnchors = new Set([
    ...c.experiences.filter((e) => e.published).map((e) => `#exp-${e.id}`),
    ...c.projects.filter((p) => p.published).map((p) => `#proj-${p.id}`),
  ]);
  for (const w of c.whyCards) {
    if (w.evidenceLink && !visibleAnchors.has(w.evidenceLink)) {
      issues.push({
        id: `broken-evidence:${w.id}`,
        severity: "error",
        kind: "broken-evidence",
        message: `Why card "${w.title.en}" trỏ tới ${w.evidenceLink}, mục này không tồn tại hoặc đang ẩn`,
        href: `/admin/why_cards/${w.id}`,
      });
    }
  }

  const experienceIds = new Set(c.experiences.map((e) => e.id));
  for (const r of c.roles) {
    if (!r.cvFileUrl.trim()) {
      issues.push({
        id: `missing-cv:${r.key}`,
        severity: "error",
        kind: "missing-cv",
        message: `Vai trò ${r.title.en} chưa có CV`,
        href: "/admin/roles",
      });
    }
    const unknown = r.experienceOrder.filter((id) => !experienceIds.has(id));
    if (unknown.length) {
      issues.push({
        id: `stale-order:${r.key}`,
        severity: "warning",
        kind: "stale-order",
        message: `Thứ tự kinh nghiệm của vai trò ${r.title.en} có mục không tồn tại: ${unknown.join(", ")}`,
        href: "/admin/roles",
      });
    }
  }

  const caseStudies = [
    ...c.experiences.map((e) => ({ href: `/admin/experiences/${e.id}`, label: e.company, cs: e.caseStudy })),
    ...c.projects.map((p) => ({ href: `/admin/projects/${p.id}`, label: p.title, cs: p.caseStudy })),
  ];
  for (const { href, label, cs } of caseStudies) {
    if (cs && Object.values(cs).some((part) => !part.en.trim())) {
      issues.push({
        id: `empty-case-study:${href}`,
        severity: "warning",
        kind: "empty-case-study",
        message: `Case study của ${label} còn phần trống (EN)`,
        href,
      });
    }
  }

  const hiddenLists = [
    { key: "experiences", label: "kinh nghiệm", items: c.experiences },
    { key: "projects", label: "dự án", items: c.projects },
    { key: "certificates", label: "chứng chỉ", items: c.certificates },
  ] as const;
  for (const { key, label, items } of hiddenLists) {
    const hidden = items.filter((i) => !i.published).length;
    if (hidden) {
      issues.push({
        id: `hidden-items:${key}`,
        severity: "info",
        kind: "hidden-items",
        count: hidden,
        message: `${hidden} ${label} đang ẩn`,
        href: `/admin/${key}`,
      });
    }
  }

  return issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => RANK[a.issue.severity] - RANK[b.issue.severity] || a.index - b.index)
    .map(({ issue }) => issue);
}
