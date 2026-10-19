import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SKILL_GROUPS, type Content } from "@/content/schema";
import {
  rowToActivity,
  rowToCertificate,
  rowToEducation,
  rowToExperience,
  rowToProfile,
  rowToProject,
  rowToRole,
  rowToSkill,
  rowToWhyCard,
  type ActivityRow,
  type CertificateRow,
  type EducationRow,
  type ExperienceRow,
  type ProfileRow,
  type ProjectRow,
  type RoleRow,
  type SkillLinkRow,
  type SkillRow,
  type WhyCardRow,
} from "./mappers";
import type { ContentRepository } from "./repository";

type Env = Record<string, string | undefined>;

/**
 * Anon-key client with no session and no cookies, so public reads can run inside `'use cache'`.
 * RLS only lets the anon role read what the public site may show.
 */
export function createPublicSupabase(env: Env = process.env): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL or anon key is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export class SupabaseRepository implements ContentRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async rows<T>(table: string, orderBy?: string): Promise<T[]> {
    const query = this.client.from(table).select("*");
    const { data, error } = await (orderBy ? query.order(orderBy, { ascending: true }) : query);
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    return (data ?? []) as T[];
  }

  async getContent(): Promise<Content> {
    const [profile, roles, experiences, projects, skills, links, certificates, activities, education, whyCards] =
      await Promise.all([
        this.rows<ProfileRow>("profile"),
        this.rows<RoleRow>("roles"),
        this.rows<ExperienceRow>("experiences", "sort_index"),
        this.rows<ProjectRow>("projects", "sort_index"),
        this.rows<SkillRow>("skills", "sort_index"),
        this.rows<SkillLinkRow>("skill_links"),
        this.rows<CertificateRow>("certificates", "sort_index"),
        this.rows<ActivityRow>("activities", "sort_index"),
        this.rows<EducationRow>("education", "sort_index"),
        this.rows<WhyCardRow>("why_cards", "sort_index"),
      ]);

    if (profile.length !== 1) {
      throw new Error(`Supabase profile: expected 1 row, got ${profile.length}`);
    }

    return {
      profile: rowToProfile(profile[0]),
      roles: roles.map(rowToRole),
      experiences: experiences.map(rowToExperience),
      projects: projects.map(rowToProject),
      // sort_index counts within a group, so order by group first to keep each group together.
      skills: skills
        .map((s) => rowToSkill(s, links))
        .sort((a, b) => SKILL_GROUPS.indexOf(a.group) - SKILL_GROUPS.indexOf(b.group) || a.sortIndex - b.sortIndex),
      certificates: certificates.map(rowToCertificate),
      activities: activities.map(rowToActivity),
      education: education.map(rowToEducation),
      whyCards: whyCards.map(rowToWhyCard),
    };
  }
}
