// Mappers between Supabase rows (snake_case) and the camelCase content model.
// Each table has a pair: rowToX (read) and xToRow (write, used by the admin and the seed script).
// Task 19 derives the SQL columns from the Row types below, so keep them in step with the tables:
//   profile, roles, experiences, projects, skills, skill_links, certificates, activities,
//   education, why_cards.
// Dates stay as text ('YYYY-MM' / 'YYYY-MM-DD'); i18n text and case studies are jsonb;
// string lists are text[]. `end`, `group` and `date` are SQL keywords, so those columns are
// end_month, skill_group and event_date.

import type {
  Activity,
  CaseStudy,
  Certificate,
  CertTopic,
  Education,
  Experience,
  I18nText,
  KoiVariety,
  Link,
  Profile,
  Project,
  Role,
  RoleKey,
  Skill,
  SkillGroup,
  WhyCard,
} from "@/content/schema";

export type ProfileRow = {
  name: string;
  location: string;
  email: string;
  linkedin: string;
  github: string;
  avatar_url: string | null;
  open_to_work: boolean;
  availability_note: I18nText;
  booking_url: string | null;
  summaries: Profile["summaries"];
};

export type RoleRow = {
  key: RoleKey;
  title: I18nText;
  koi_variety: KoiVariety;
  cv_file_url: string;
  experience_order: string[];
  skill_group_order: SkillGroup[];
};

export type ExperienceRow = {
  id: string;
  company: string;
  parent_company: string | null;
  location: string;
  position: I18nText;
  start_month: string;
  end_month: string | null;
  employment_type: Experience["employmentType"];
  summary: I18nText;
  case_study: CaseStudy | null;
  team_size: string | null;
  tech: string[];
  links: Link[];
  published: boolean;
  sort_index: number;
};

export type ProjectRow = {
  id: string;
  title: string;
  role: I18nText;
  start_month: string;
  end_month: string | null;
  summary: I18nText;
  case_study: CaseStudy | null;
  tech: string[];
  demo_url: string | null;
  repo_urls: string[];
  poster_url: string | null;
  video_url: string | null;
  published: boolean;
  sort_index: number;
};

export type SkillRow = {
  id: string;
  name: string;
  skill_group: SkillGroup;
  sort_index: number;
};

/** One row per link; exactly one of experience_id / project_id is set. */
export type SkillLinkRow = {
  skill_id: string;
  experience_id: string | null;
  project_id: string | null;
};

export type CertificateRow = {
  id: string;
  name: string;
  organization: string;
  issue_date: string;
  credential_id: string | null;
  credential_url: string | null;
  file_url: string | null;
  topic: CertTopic;
  skills: string[];
  description: I18nText;
  published: boolean;
  sort_index: number;
};

export type ActivityRow = {
  id: string;
  name: I18nText;
  event_date: string;
  skills: string[];
  description: I18nText;
  sort_index: number;
};

export type EducationRow = {
  id: string;
  school: string;
  degree: I18nText;
  major: I18nText;
  start_month: string;
  end_month: string | null;
  gpa: string | null;
  notes: I18nText | null;
  sort_index: number;
};

export type WhyCardRow = {
  id: string;
  title: I18nText;
  subtitle: I18nText;
  tag: I18nText;
  body: I18nText;
  colors: string[];
  evidence_link: string | null;
  sort_index: number;
};

// profile

export function rowToProfile(r: ProfileRow): Profile {
  return {
    name: r.name,
    location: r.location,
    email: r.email,
    linkedin: r.linkedin,
    github: r.github,
    avatarUrl: r.avatar_url,
    openToWork: r.open_to_work,
    availabilityNote: r.availability_note,
    bookingUrl: r.booking_url,
    summaries: r.summaries,
  };
}

export function profileToRow(p: Profile): ProfileRow {
  return {
    name: p.name,
    location: p.location,
    email: p.email,
    linkedin: p.linkedin,
    github: p.github,
    avatar_url: p.avatarUrl,
    open_to_work: p.openToWork,
    availability_note: p.availabilityNote,
    booking_url: p.bookingUrl,
    summaries: p.summaries,
  };
}

// roles

export function rowToRole(r: RoleRow): Role {
  return {
    key: r.key,
    title: r.title,
    koiVariety: r.koi_variety,
    cvFileUrl: r.cv_file_url,
    experienceOrder: r.experience_order,
    skillGroupOrder: r.skill_group_order,
  };
}

export function roleToRow(r: Role): RoleRow {
  return {
    key: r.key,
    title: r.title,
    koi_variety: r.koiVariety,
    cv_file_url: r.cvFileUrl,
    experience_order: r.experienceOrder,
    skill_group_order: r.skillGroupOrder,
  };
}

// experiences

export function rowToExperience(r: ExperienceRow): Experience {
  return {
    id: r.id,
    company: r.company,
    parentCompany: r.parent_company,
    location: r.location,
    position: r.position,
    start: r.start_month,
    end: r.end_month,
    employmentType: r.employment_type,
    summary: r.summary,
    caseStudy: r.case_study,
    teamSize: r.team_size,
    tech: r.tech,
    links: r.links,
    published: r.published,
    sortIndex: r.sort_index,
  };
}

export function experienceToRow(e: Experience): ExperienceRow {
  return {
    id: e.id,
    company: e.company,
    parent_company: e.parentCompany,
    location: e.location,
    position: e.position,
    start_month: e.start,
    end_month: e.end,
    employment_type: e.employmentType,
    summary: e.summary,
    case_study: e.caseStudy,
    team_size: e.teamSize,
    tech: e.tech,
    links: e.links,
    published: e.published,
    sort_index: e.sortIndex,
  };
}

// projects

export function rowToProject(r: ProjectRow): Project {
  return {
    id: r.id,
    title: r.title,
    role: r.role,
    start: r.start_month,
    end: r.end_month,
    summary: r.summary,
    caseStudy: r.case_study,
    tech: r.tech,
    demoUrl: r.demo_url,
    repoUrls: r.repo_urls,
    posterUrl: r.poster_url,
    videoUrl: r.video_url,
    published: r.published,
    sortIndex: r.sort_index,
  };
}

export function projectToRow(p: Project): ProjectRow {
  return {
    id: p.id,
    title: p.title,
    role: p.role,
    start_month: p.start,
    end_month: p.end,
    summary: p.summary,
    case_study: p.caseStudy,
    tech: p.tech,
    demo_url: p.demoUrl,
    repo_urls: p.repoUrls,
    poster_url: p.posterUrl,
    video_url: p.videoUrl,
    published: p.published,
    sort_index: p.sortIndex,
  };
}

// skills (links live in skill_links)

export function rowToSkill(r: SkillRow, links: SkillLinkRow[]): Skill {
  const own = links.filter((l) => l.skill_id === r.id);
  return {
    id: r.id,
    name: r.name,
    group: r.skill_group,
    sortIndex: r.sort_index,
    experienceIds: own.flatMap((l) => (l.experience_id ? [l.experience_id] : [])),
    projectIds: own.flatMap((l) => (l.project_id ? [l.project_id] : [])),
  };
}

export function skillToRow(s: Skill): SkillRow {
  return { id: s.id, name: s.name, skill_group: s.group, sort_index: s.sortIndex };
}

export function skillToLinkRows(s: Skill): SkillLinkRow[] {
  return [
    ...s.experienceIds.map((id) => ({ skill_id: s.id, experience_id: id, project_id: null })),
    ...s.projectIds.map((id) => ({ skill_id: s.id, experience_id: null, project_id: id })),
  ];
}

// certificates

export function rowToCertificate(r: CertificateRow): Certificate {
  return {
    id: r.id,
    name: r.name,
    organization: r.organization,
    issueDate: r.issue_date,
    credentialId: r.credential_id,
    credentialUrl: r.credential_url,
    fileUrl: r.file_url,
    topic: r.topic,
    skills: r.skills,
    description: r.description,
    published: r.published,
    sortIndex: r.sort_index,
  };
}

export function certificateToRow(c: Certificate): CertificateRow {
  return {
    id: c.id,
    name: c.name,
    organization: c.organization,
    issue_date: c.issueDate,
    credential_id: c.credentialId,
    credential_url: c.credentialUrl,
    file_url: c.fileUrl,
    topic: c.topic,
    skills: c.skills,
    description: c.description,
    published: c.published,
    sort_index: c.sortIndex,
  };
}

// activities

export function rowToActivity(r: ActivityRow): Activity {
  return {
    id: r.id,
    name: r.name,
    date: r.event_date,
    skills: r.skills,
    description: r.description,
    sortIndex: r.sort_index,
  };
}

export function activityToRow(a: Activity): ActivityRow {
  return {
    id: a.id,
    name: a.name,
    event_date: a.date,
    skills: a.skills,
    description: a.description,
    sort_index: a.sortIndex,
  };
}

// education

export function rowToEducation(r: EducationRow): Education {
  return {
    id: r.id,
    school: r.school,
    degree: r.degree,
    major: r.major,
    start: r.start_month,
    end: r.end_month,
    gpa: r.gpa,
    notes: r.notes,
    sortIndex: r.sort_index,
  };
}

export function educationToRow(e: Education): EducationRow {
  return {
    id: e.id,
    school: e.school,
    degree: e.degree,
    major: e.major,
    start_month: e.start,
    end_month: e.end,
    gpa: e.gpa,
    notes: e.notes,
    sort_index: e.sortIndex,
  };
}

// why cards

export function rowToWhyCard(r: WhyCardRow): WhyCard {
  const [from, to] = r.colors;
  if (r.colors.length !== 2 || !from || !to) {
    throw new Error(`why_cards.colors must hold exactly 2 colors (card ${r.id})`);
  }
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    tag: r.tag,
    body: r.body,
    colors: [from, to],
    evidenceLink: r.evidence_link,
    sortIndex: r.sort_index,
  };
}

export function whyCardToRow(w: WhyCard): WhyCardRow {
  return {
    id: w.id,
    title: w.title,
    subtitle: w.subtitle,
    tag: w.tag,
    body: w.body,
    colors: [...w.colors],
    evidence_link: w.evidenceLink,
    sort_index: w.sortIndex,
  };
}
