import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import { assertLocalSupabase } from "../../scripts/ci/local-supabase.mjs";

// A dead local proxy denies external destinations without intercepting or mocking
// any request. Chromium bypasses it only for the literal loopback host.
export const localOnlyProxy = {
  server: "http://127.0.0.1:9",
  bypass: "127.0.0.1",
};

const fixtureSchema = z
  .object({
    version: z.literal(1),
    runId: z.string().regex(/^[1-9][0-9]{0,19}$/),
    apiUrl: z.literal("http://127.0.0.1:55321"),
    admin: z
      .object({
        email: z.literal("task4-admin@example.invalid"),
        password: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
      })
      .strict(),
    member: z
      .object({
        email: z.literal("task4-member@example.invalid"),
        password: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
      })
      .strict(),
    fixtures: z
      .object({
        certificateIds: z.tuple([
          z.literal("task4-certificate-a"),
          z.literal("task4-certificate-b"),
        ]),
      })
      .strict(),
  })
  .strict();

export type Task4Settings = z.infer<typeof fixtureSchema> & {
  appOrigin: string;
};

export function readTask4Settings(
  env: NodeJS.ProcessEnv = process.env,
): Task4Settings {
  // No environment file is read. In particular, no service-role key belongs in
  // this process. The launcher passes app configuration to its own child only.
  for (const key of Object.keys(env)) {
    if (
      /SUPABASE|POSTGRES|DATABASE|(?:^|_)(?:SB|DB|PG[A-Z0-9_]*|KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS?|AUTH|SERVICE_ROLE)(?:_|$)|^(?:API_URL|DIRECT_URL|ADMIN_EMAIL|DEBUG|PWDEBUG)$/i.test(
        key,
      ) &&
      env[key]
    )
      throw new Error("Task4 browser environment contains forbidden settings");
  }
  try {
    const appOrigin = assertLocalSupabase(env.TASK4_APP_ORIGIN);
    if (env.TASK4_APP_ORIGIN !== "http://127.0.0.1:4327") throw new Error();
    const path = env.TASK4_FIXTURE_FILE;
    if (!path || !isAbsolute(path) || !path.endsWith(".json"))
      throw new Error();
    // The launcher runs from the fresh private source copy, with node_modules
    // symlinked. Never resolve this boundary relative to the dependency tree.
    const root = realpathSync(process.cwd());
    const expected = resolve(root, ".superpowers/task4-fixture.json");
    if (path !== expected) throw new Error();
    // Open before checking metadata. O_NOFOLLOW rejects a final symlink on Linux;
    // validation and reading must use this same descriptor if the path changes.
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = fstatSync(fd);
      // This exact path is ignored by the committed .gitignore. The seed emits
      // two distinct 24-byte base64url passwords; the launcher writes mode 0600.
      if (
        realpathSync(path) !== expected ||
        !stat.isFile() ||
        stat.size === 0 ||
        stat.size > 16_384 ||
        stat.nlink !== 1 ||
        (process.platform === "linux" &&
          ((stat.mode & 0o7777) !== 0o600 || stat.uid !== process.getuid?.()))
      )
        throw new Error();
      const fixture = fixtureSchema.parse(JSON.parse(readFileSync(fd, "utf8")));
      if (fixture.admin.password === fixture.member.password) throw new Error();
      if (env.TASK4_RUN_ID !== undefined && env.TASK4_RUN_ID !== fixture.runId)
        throw new Error();
      assertLocalSupabase(fixture.apiUrl);
      return { ...fixture, appOrigin };
    } finally {
      closeSync(fd);
    }
  } catch {
    // Do not print rejected JSON, paths, endpoints, passwords or Zod errors.
    throw new Error(
      "Task4 requires an explicit owned local app and valid private fixture",
    );
  }
}
