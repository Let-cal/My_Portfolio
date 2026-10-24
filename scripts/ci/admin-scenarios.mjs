import { fileURLToPath } from "node:url";

export const adminScenarioFile = fileURLToPath(
  new URL("../../tests/e2e-admin/admin-flows.spec.ts", import.meta.url),
);
export const adminScenarioProject = "task4-local-chrome";

// Titles are exact identities, never copied into the published report.
export const adminScenarios = Object.freeze(
  [
    ["auth", "local authentication, logout and anonymous/member denial"],
    [
      "crud",
      "certificate CRUD, public visibility and persisted keyboard ordering",
    ],
    [
      "drafts",
      "a local draft survives reload, restores and clears after a real save",
    ],
    [
      "realtime",
      "two tabs receive real updates, retain conflicting edits and notice deletion",
    ],
    [
      "session",
      "cross-tab signout preserves the form and real reauthentication resumes saving",
    ],
    [
      "offline",
      "network simulation: offline edits recover and save to the real backend",
    ],
  ].map(([id, title]) => Object.freeze({ id, title })),
);
