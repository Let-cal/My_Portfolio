import { randomBytes } from "node:crypto";
import { assertLocalSupabase } from "./local-supabase.mjs";

export function syntheticRows() {
  const text = {
    en: "Synthetic integration fixture",
    ja: "テスト用",
    vi: "Dữ liệu kiểm thử",
  };
  return {
    profile: {
      id: "me",
      name: "Task Four Fixture",
      location: "Test location",
      email: "task4-public@example.invalid",
      linkedin: "https://example.invalid/linkedin",
      github: "https://example.invalid/github",
      avatar_url: null,
      open_to_work: false,
      availability_note: text,
      booking_url: null,
      summaries: { fullstack: text, techlead: text, pm: text },
    },
    roles: ["fullstack", "techlead", "pm"].map((key, i) => ({
      key,
      title: text,
      koi_variety: ["kohaku", "showa", "ogon"][i],
      cv_file_url: "/test-item.pdf",
      experience_order: [],
      skill_group_order: ["languages"],
    })),
    certificates: ["a", "b", "public"].map((key, i) => ({
      id: `task4-certificate-${key}`,
      name: `test-item ${key}`,
      organization: "Synthetic issuer",
      issue_date: "2026-01-01",
      credential_id: null,
      credential_url: null,
      file_url: null,
      topic: "engineering",
      skills: [],
      description: text,
      published: key === "public",
      sort_index: i,
    })),
  };
}

// Each becomes `task4-${kind}@example.invalid`. Only the launcher's psql step grants
// a role (admin by email, reviewer by auth user id); member stays an ordinary user.
export const syntheticIdentityKinds = Object.freeze([
  "admin",
  "member",
  "reviewer",
]);

// The browser fixture schema (tests/e2e-admin/settings.ts) is strict and the browser
// suite never signs in as the reviewer, so its credentials stay in the launcher process.
export function browserFixture(fixture) {
  const { version, runId, apiUrl, admin, member, fixtures } = fixture;
  return { version, runId, apiUrl, admin, member, fixtures };
}

/** Caller must establish fresh Docker ownership before provisioning. No standalone CLI. */
export async function seedAdmin({ apiUrl, serviceRoleKey, runId }) {
  const origin = assertLocalSupabase(apiUrl);
  if (
    !/^[1-9][0-9]{0,19}$/.test(runId ?? "") ||
    typeof serviceRoleKey !== "string" ||
    !serviceRoleKey
  ) {
    throw new Error("Invalid disposable seed inputs");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(origin, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        if (
          new URL(
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url,
          ).origin !== origin
        )
          throw new Error("Nonlocal fixture request denied");
        return fetch(input, {
          ...init,
          redirect: "error",
          signal: AbortSignal.timeout(30000),
        });
      },
    },
  });
  const identities = {};
  try {
    for (const kind of syntheticIdentityKinds) {
      const email = `task4-${kind}@example.invalid`,
        password = randomBytes(24).toString("base64url");
      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user)
        throw new Error("Synthetic identity was not created");
      identities[kind] = { email, password };
    }
    for (const [table, rows] of Object.entries(syntheticRows())) {
      const { error } = await client.from(table).insert(rows);
      if (error) throw new Error("Synthetic content was not created");
    }
  } catch {
    throw new Error("Disposable fixture provisioning failed");
  }
  return {
    version: 1,
    runId,
    apiUrl: origin,
    ...identities,
    fixtures: {
      certificateIds: ["task4-certificate-a", "task4-certificate-b"],
    },
  };
}
