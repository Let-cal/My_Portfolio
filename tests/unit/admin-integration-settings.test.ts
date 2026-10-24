import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readTask4Settings, localOnlyProxy } from "../e2e-admin/settings";

const originalRoot = process.cwd();
const resultsRoot = resolve(originalRoot, "test-results");
let sandbox: string, fixturePath: string;
function fixture() {
  return {
    version: 1,
    runId: "123",
    apiUrl: "http://127.0.0.1:55321",
    admin: { email: "task4-admin@example.invalid", password: "a".repeat(32) },
    member: { email: "task4-member@example.invalid", password: "b".repeat(32) },
    fixtures: {
      certificateIds: ["task4-certificate-a", "task4-certificate-b"],
    },
  };
}
function env() {
  return {
    NODE_ENV: "test" as const,
    TASK4_APP_ORIGIN: "http://127.0.0.1:4327",
    TASK4_FIXTURE_FILE: fixturePath,
    TASK4_RUN_ID: "123",
  };
}
beforeEach(() => {
  mkdirSync(resultsRoot, { recursive: true });
  sandbox = mkdtempSync(join(resultsRoot, "task4-settings-"));
  mkdirSync(join(sandbox, ".superpowers"));
  fixturePath = join(sandbox, ".superpowers/task4-fixture.json");
  writeFileSync(fixturePath, JSON.stringify(fixture()), { mode: 0o600 });
  vi.spyOn(process, "cwd").mockReturnValue(sandbox);
});
afterEach(() => {
  vi.restoreAllMocks();
  // Only this test's mkdtemp child, resolved inside the owned workspace, is removed.
  if (
    dirname(resolve(sandbox)) !== resultsRoot ||
    !sandbox.startsWith(join(resultsRoot, "task4-settings-"))
  )
    throw new Error("Unexpected test cleanup target");
  rmSync(sandbox, { recursive: true });
});
describe("private disposable admin browser settings", () => {
  it("reads the exact owned synthetic fixture and emits only the intended app settings", () => {
    expect(readTask4Settings(env())).toEqual({
      ...fixture(),
      appOrigin: "http://127.0.0.1:4327",
    });
    expect(localOnlyProxy).toEqual({
      server: "http://127.0.0.1:9",
      bypass: "127.0.0.1",
    });
  });
  for (const origin of [
    "https://project.supabase.co",
    "http://localhost:4327",
    "http://127.0.0.1:3000",
    "http://user@127.0.0.1:4327",
  ])
    it(`refuses an unowned app destination ${origin}`, () => {
      expect(() =>
        readTask4Settings({ ...env(), TASK4_APP_ORIGIN: origin }),
      ).toThrow();
    });
  for (const name of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "DATABASE_URL",
    "GITHUB_TOKEN",
    "PWDEBUG",
  ])
    it(`refuses inherited ${name}`, () => {
      expect(() =>
        readTask4Settings({ ...env(), [name]: "SENSITIVE-SENTINEL" }),
      ).toThrow();
    });
  it("rejects foreign fixture shape without including rejected data in diagnostics", () => {
    writeFileSync(
      fixturePath,
      JSON.stringify({ ...fixture(), serviceRoleKey: "SENSITIVE-SENTINEL" }),
    );
    expect(() => readTask4Settings(env())).toThrow(
      "Task4 requires an explicit owned local app and valid private fixture",
    );
  });
  it("rejects a fixture for another run and equal identity passwords", () => {
    expect(() =>
      readTask4Settings({ ...env(), TASK4_RUN_ID: "124" }),
    ).toThrow();
    const data = fixture();
    data.member.password = data.admin.password;
    writeFileSync(fixturePath, JSON.stringify(data));
    expect(() => readTask4Settings(env())).toThrow();
  });
  it("rejects fixture paths outside the exact private file", () => {
    const other = join(sandbox, "other.json");
    writeFileSync(other, readFileSync(fixturePath));
    expect(() =>
      readTask4Settings({ ...env(), TASK4_FIXTURE_FILE: other }),
    ).toThrow();
  });
});
