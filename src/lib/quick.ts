import type { Certificate, Content, Locale, RoleKey, SkillGroup } from "@/content/schema";
import { formatPeriod } from "./format";
import { pickLocale } from "./i18n-text";
import { orderExperiences, orderSkillGroups } from "./roles";

/** How many experiences and certificates the one-page view shows. */
export const QUICK_EXPERIENCE_COUNT = 4;
export const QUICK_CERTIFICATE_COUNT = 4;

/**
 * Certificates a recruiter reads first: the Japanese level, then project management, the software lifecycle
 * and UX. Ids that are missing or unpublished are skipped and the rest is filled in `sortIndex` order.
 */
const FEATURED_CERTIFICATE_IDS = ["jlpt-n3", "coursera-pm-principles", "coursera-sdlc", "coursera-ux-research-design"];

export function featuredCertificates(certificates: Certificate[], count = QUICK_CERTIFICATE_COUNT): Certificate[] {
  const published = certificates.filter((c) => c.published).sort((a, b) => a.sortIndex - b.sortIndex);
  const byId = new Map(published.map((c) => [c.id, c]));
  const picked: Certificate[] = [];
  for (const id of FEATURED_CERTIFICATE_IDS) {
    const c = byId.get(id);
    if (c) picked.push(c);
  }
  for (const c of published) {
    if (picked.length >= count) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked.slice(0, count);
}

/** `https://www.linkedin.com/in/letcal/` becomes `linkedin.com/in/letcal`. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

export type QuickData = {
  name: string;
  location: string;
  email: string;
  linkedin: { href: string; label: string };
  github: { href: string; label: string };
  openToWork: boolean;
  availabilityNote: string;
  roleTitle: string;
  summary: string;
  cvFileUrl: string;
  /** The employer when every listed experience shares one (it is then printed once, not on every line). */
  employer: string | null;
  experiences: { id: string; company: string; parentCompany: string | null; position: string; period: string }[];
  skillGroups: { group: SkillGroup; names: string[] }[];
  certificates: { id: string; name: string; organization: string; year: string }[];
  education: { school: string; degree: string; major: string; gpa: string | null; period: string; notes: string } | null;
};

/** Everything the 60-second view prints, picked and localized for one role. No phone number exists in the content. */
export function buildQuickData(content: Content, locale: Locale, roleKey: RoleKey): QuickData {
  const { profile, roles, experiences, skills, certificates, education } = content;
  const role = roles.find((r) => r.key === roleKey) ?? roles[0];
  const listed = orderExperiences(experiences, role).slice(0, QUICK_EXPERIENCE_COUNT);
  const employer = listed.length > 0 && listed.every((e) => e.parentCompany && e.parentCompany === listed[0].parentCompany) ? listed[0].parentCompany : null;
  const school = [...education].sort((a, b) => a.sortIndex - b.sortIndex)[0];

  return {
    name: profile.name,
    location: profile.location,
    email: profile.email,
    linkedin: { href: profile.linkedin, label: displayUrl(profile.linkedin) },
    github: { href: profile.github, label: displayUrl(profile.github) },
    openToWork: profile.openToWork,
    availabilityNote: pickLocale(profile.availabilityNote, locale),
    roleTitle: pickLocale(role.title, locale),
    summary: pickLocale(profile.summaries[role.key], locale),
    cvFileUrl: role.cvFileUrl,
    employer,
    experiences: listed.map((e) => ({
      id: e.id,
      company: e.company,
      parentCompany: employer ? null : e.parentCompany,
      position: pickLocale(e.position, locale),
      period: formatPeriod(e.start, e.end, locale),
    })),
    skillGroups: orderSkillGroups(role)
      .map((group) => ({
        group,
        names: skills
          .filter((s) => s.group === group)
          .sort((a, b) => a.sortIndex - b.sortIndex)
          .map((s) => s.name),
      }))
      .filter((g) => g.names.length > 0),
    certificates: featuredCertificates(certificates).map((c) => ({
      id: c.id,
      name: c.name,
      organization: c.organization,
      year: c.issueDate.slice(0, 4),
    })),
    education: school
      ? {
          school: school.school,
          degree: pickLocale(school.degree, locale),
          major: pickLocale(school.major, locale),
          gpa: school.gpa,
          period: formatPeriod(school.start, school.end, locale),
          notes: pickLocale(school.notes, locale),
        }
      : null,
  };
}
