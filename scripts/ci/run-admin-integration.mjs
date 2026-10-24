import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  copyFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRunSpec,
  isolatedProcessEnv,
  assertOwnedContainers,
  assertOwnedNetwork,
  validateLocalStatus,
  assertSanitizedLauncherEnv,
} from "./disposable-runtime.mjs";
import { seedAdmin } from "./seed-admin.mjs";
import { verifyAdminBackend } from "./verify-admin-backend.mjs";
import { projectAdminSummary } from "./admin-reporter.mjs";
import { projectBackendFailure } from "./backend-progress.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const summaryPath = join(root, "reports/admin-integration-summary.json");
const expectedVersion = "2.122.0";
const children = new Set();
let cancelled = false;
function signal() {
  cancelled = true;
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* Child may have exited. */
    }
  }
}

function capture(command, args, options = {}) {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 60000,
    ...options,
  });
  if (r.error || r.status !== 0)
    throw new Error("Disposable environment command failed");
  return r.stdout;
}
function run(command, args, { cwd, env, log, input, timeout = 900000 }) {
  return new Promise((resolveRun, reject) => {
    if (cancelled) {
      reject(new Error("Disposable run cancelled"));
      return;
    }
    const fd = openSync(log, "a", 0o600);
    const child = spawn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: [input === undefined ? "ignore" : "pipe", fd, fd],
    });
    children.add(child);
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Exited. */
      }
    }, timeout);
    const hard = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* Exited. */
      }
    }, timeout + 5000);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(hard);
      children.delete(child);
      closeSync(fd);
    };
    child.once("error", () => {
      finish();
      reject(new Error("Disposable command could not start"));
    });
    child.once("exit", (code) => {
      finish();
      if (code === 0 && !cancelled) resolveRun();
      else reject(new Error("Disposable command failed"));
    });
    if (input !== undefined) {
      child.stdin.on("error", () => {});
      child.stdin.end(input);
    }
  });
}
async function unusedPort(port) {
  await new Promise((resolvePort, reject) => {
    const s = createServer();
    s.once("error", () =>
      reject(new Error("Disposable run port is already occupied")),
    );
    s.listen(port, "127.0.0.1", () => s.close(resolvePort));
  });
}
async function ready(url, child) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && !cancelled && child.exitCode === null) {
    try {
      const r = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(3000),
      });
      await r.body?.cancel();
      if (r.status === 200) return;
    } catch {
      /* Startup is still in progress. */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Disposable application was not ready");
}
function copySource(destination, env) {
  const files = capture("git", ["ls-files", "-z"], { cwd: root, env })
    .split("\0")
    .filter(Boolean);
  for (const file of files) {
    if (
      isAbsolute(file) ||
      file.split("/").includes("..") ||
      file.includes("\\")
    )
      throw new Error("Invalid tracked source path");
    if (file.split("/").some((part) => part.startsWith(".env"))) {
      if (file === ".env.example") continue;
      throw new Error(
        "Environment files cannot enter the isolated source tree",
      );
    }
    const source = join(root, file);
    if (!lstatSync(source).isFile() || lstatSync(source).isSymbolicLink())
      throw new Error("Only regular tracked source files are allowed");
    const target = join(destination, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
  symlinkSync(
    realpathSync(join(root, "node_modules")),
    join(destination, "node_modules"),
    "dir",
  );
}
function projectContainers(spec, env) {
  const ids = capture(
    "docker",
    [
      "ps",
      "-aq",
      "--filter",
      `label=com.supabase.cli.project=${spec.projectId}`,
    ],
    { env },
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!ids.length) return [];
  if (ids.some((id) => !/^[a-f0-9]{12,64}$/.test(id)))
    throw new Error("Unexpected Docker container identity");
  return JSON.parse(capture("docker", ["inspect", ...ids], { env }));
}
function assertCleanupOwnership(containers, spec) {
  for (const c of containers)
    if (
      !/^[a-f0-9]{64}$/.test(c.Id ?? "") ||
      c.Config?.Labels?.["com.supabase.cli.project"] !== spec.projectId ||
      !c.Name?.endsWith(`_${spec.projectId}`)
    )
      throw new Error("Cleanup ownership mismatch");
}

export async function runAdminIntegration() {
  const started = Date.now();
  let phaseStarted = started;
  let spec,
    work,
    env,
    app,
    cli,
    server,
    serverFd,
    networkId,
    networkName,
    attempted = false;
  const report = {
    version: 1,
    status: "BLOCKED",
    phase: "bootstrap",
    revision: null,
    runId: null,
    runAttempt: null,
    realServicesVerified: false,
    timingsMs: {},
  };
  const setPhase = (name) => {
    report.timingsMs[report.phase] = Date.now() - phaseStarted;
    phaseStarted = Date.now();
    report.phase = name;
  };
  mkdirSync(dirname(summaryPath), { recursive: true });
  process.on("SIGINT", signal);
  process.on("SIGTERM", signal);
  try {
    if (
      process.platform !== "linux" ||
      process.env.GITHUB_ACTIONS !== "true" ||
      process.env.RUNNER_ENVIRONMENT !== "github-hosted"
    )
      throw new Error("Requires a fresh GitHub-hosted Linux runner");
    assertSanitizedLauncherEnv(process.env);
    spec = createRunSpec(
      {
        runId: process.env.GITHUB_RUN_ID,
        attempt: process.env.GITHUB_RUN_ATTEMPT,
        nonce: randomBytes(4).toString("hex"),
      },
      process.platform,
    );
    if (!/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? ""))
      throw new Error("Expected current CI revision");
    report.revision = process.env.GITHUB_SHA;
    report.runId = spec.runId;
    report.runAttempt = process.env.GITHUB_RUN_ATTEMPT;
    work = mkdtempSync(join(tmpdir(), "task4-owned-"));
    const home = join(work, "home");
    mkdirSync(join(home, "tmp"), { recursive: true, mode: 0o700 });
    env = isolatedProcessEnv(process.env, home);
    capture("docker", ["version", "--format", "{{.Server.Version}}"], { env });
    report.browserVersion = capture("google-chrome", ["--version"], { env })
      .trim()
      .replace(/[^A-Za-z0-9 .-]/g, "")
      .slice(0, 100);
    for (const resource of [
      ["ps", "-aq"],
      ["volume", "ls", "-q"],
      ["network", "ls", "-q"],
    ]) {
      if (
        capture(
          "docker",
          [
            ...resource,
            "--filter",
            `label=com.supabase.cli.project=${spec.projectId}`,
          ],
          { env },
        ).trim()
      )
        throw new Error("Run namespace already has Docker resources");
    }
    for (const port of [4327, 55321, 55322]) await unusedPort(port);
    app = join(work, "app");
    mkdirSync(app, { mode: 0o700 });
    if (
      capture("git", ["rev-parse", "HEAD"], { cwd: root, env }).trim() !==
      report.revision
    )
      throw new Error("Checkout revision does not match current CI");
    capture("git", ["diff", "--quiet", "HEAD", "--"], { cwd: root, env });
    copySource(app, env);
    cli = join(app, "node_modules/supabase/dist/supabase.js");
    if (
      capture(process.execPath, [cli, "--version"], {
        cwd: app,
        env,
      }).trim() !== expectedVersion
    )
      throw new Error("Supabase CLI version mismatch");
    const configPath = join(app, "supabase/config.toml");
    const config = readFileSync(configPath, "utf8");
    if (!config.includes('project_id = "task4-template"'))
      throw new Error("Unexpected disposable config template");
    writeFileSync(
      configPath,
      config.replace(
        'project_id = "task4-template"',
        `project_id = "${spec.projectId}"`,
      ),
    );
    const args = ["--workdir", app, "--agent", "no"];
    setPhase("network-create");
    networkName = `task4-net-${spec.projectId}`;
    networkId = capture(
      "docker",
      [
        "network",
        "create",
        "--driver",
        "bridge",
        "--label",
        `com.supabase.cli.project=${spec.projectId}`,
        "--opt",
        "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
        networkName,
      ],
      { env },
    ).trim();
    assertOwnedNetwork(
      JSON.parse(
        capture("docker", ["network", "inspect", networkId], { env }),
      )[0],
      spec,
      networkId,
    );
    setPhase("stack-start");
    attempted = true;
    await run(
      process.execPath,
      [
        cli,
        ...args,
        "--network-id",
        networkName,
        "start",
        "--exclude",
        "studio,postgres-meta,mailpit,edge-runtime,logflare,vector,supavisor,imgproxy",
        "--yes",
      ],
      { cwd: app, env, log: join(work, "stack-private.log") },
    );
    setPhase("ownership");
    const ownership = assertOwnedContainers(projectContainers(spec, env), spec);
    const status = JSON.parse(
      capture(process.execPath, [cli, ...args, "status", "--output", "json"], {
        cwd: app,
        env,
      }),
    );
    const appSettings = validateLocalStatus(status, spec);
    setPhase("migrations");
    const expectedMigrations = readdirSync(join(app, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => {
        const m = /^([0-9]+)_.+\.sql$/.exec(f);
        if (!m) throw new Error("Unexpected migration filename");
        return m[1];
      })
      .sort();
    const applied = capture(
      "docker",
      [
        "exec",
        ownership.databaseId,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-Atc",
        "select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations",
      ],
      { env },
    )
      .trim()
      .split(",");
    if (
      !expectedMigrations.length ||
      new Set(expectedMigrations).size !== expectedMigrations.length ||
      JSON.stringify(applied) !== JSON.stringify(expectedMigrations)
    )
      throw new Error(
        "Empty database migration replay did not match committed history",
      );
    await run(
      "docker",
      [
        "exec",
        "-i",
        ownership.databaseId,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        cwd: app,
        env,
        log: join(work, "migration-private.log"),
        input:
          "insert into private.app_admins(email) values ('task4-admin@example.invalid');\n",
      },
    );
    report.migrations = expectedMigrations.length;
    setPhase("seed");
    const fixture = await seedAdmin({
      apiUrl: spec.apiUrl,
      serviceRoleKey: status.SERVICE_ROLE_KEY,
      runId: spec.runId,
    });
    mkdirSync(join(app, ".superpowers"), { mode: 0o700 });
    const fixturePath = join(app, ".superpowers/task4-fixture.json");
    writeFileSync(fixturePath, JSON.stringify(fixture), { mode: 0o600 });
    // Provisioning credentials remain in this process, never in app/browser env or artifacts.
    delete status.SERVICE_ROLE_KEY;
    delete status.JWT_SECRET;
    delete status.SECRET_KEY;
    setPhase("backend");
    report.backend = await verifyAdminBackend(fixture, status.ANON_KEY);
    report.realServicesVerified = true;
    setPhase("build");
    const appEnv = { ...env, ...appSettings, NODE_ENV: "production" };
    await run("npm", ["run", "build"], {
      cwd: app,
      env: appEnv,
      log: join(work, "build-private.log"),
    });
    serverFd = openSync(join(work, "server-private.log"), "a", 0o600);
    server = spawn(
      process.execPath,
      [
        join(app, "node_modules/next/dist/bin/next"),
        "start",
        "-p",
        "4327",
        "-H",
        "127.0.0.1",
      ],
      {
        cwd: app,
        env: appEnv,
        detached: true,
        stdio: ["ignore", serverFd, serverFd],
      },
    );
    children.add(server);
    server.on("error", () => {});
    await ready(`${spec.appOrigin}/admin/login`, server);
    setPhase("browser");
    const browserSummary = join(work, "browser-summary.json");
    const browserEnv = {
      ...env,
      TASK4_APP_ORIGIN: spec.appOrigin,
      TASK4_FIXTURE_FILE: fixturePath,
      TASK4_BROWSER_SUMMARY: browserSummary,
      TASK4_REVISION: report.revision,
      TASK4_RUN_ID: spec.runId,
      TASK4_RUN_ATTEMPT: report.runAttempt,
      PLAYWRIGHT_NO_COPY_PROMPT: "1",
    };
    let browserFailed = false;
    try {
      await run(
        process.execPath,
        [
          join(app, "node_modules/@playwright/test/cli.js"),
          "test",
          "--config",
          join(app, "playwright.admin.config.ts"),
          "--reporter",
          join(app, "scripts/ci/admin-reporter.mjs"),
        ],
        { cwd: app, env: browserEnv, log: join(work, "browser-private.log") },
      );
    } catch {
      browserFailed = true;
    }
    if (existsSync(browserSummary))
      report.browser = projectAdminSummary(
        JSON.parse(readFileSync(browserSummary, "utf8")),
        {
          revision: report.revision,
          runId: spec.runId,
          attempt: report.runAttempt,
        },
      );
    if (
      browserFailed ||
      report.browser?.status !== "PASS" ||
      report.browser.revision !== report.revision ||
      report.browser.runId !== spec.runId ||
      report.browser.runAttempt !== report.runAttempt
    )
      throw new Error("Browser evidence did not match current run");
    report.status = "PASS";
    setPhase("complete");
  } catch (error) {
    const failure = projectBackendFailure(error);
    if (failure) report.backendFailure = failure;
    report.status = report.phase === "bootstrap" ? "BLOCKED" : "FAIL";
  } finally {
    if (server) {
      children.delete(server);
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        /* Already exited. */
      }
      await new Promise((resolveExit) => {
        const t = setTimeout(() => {
          try {
            process.kill(-server.pid, "SIGKILL");
          } catch {
            /* Exited. */
          }
          resolveExit();
        }, 3000);
        server.once("exit", () => {
          clearTimeout(t);
          resolveExit();
        });
      });
      if (serverFd !== undefined) closeSync(serverFd);
    }
    if (attempted) {
      try {
        assertCleanupOwnership(projectContainers(spec, env), spec);
        capture(
          process.execPath,
          [
            cli,
            "--workdir",
            app,
            "--agent",
            "no",
            "stop",
            "--project-id",
            spec.projectId,
            "--no-backup",
          ],
          { cwd: app, env, timeout: 120000 },
        );
        report.cleanup = "owned-project-stopped";
      } catch {
        report.cleanup = "failed";
        report.status = "FAIL";
      }
    }
    if (networkId) {
      try {
        // CLI stop may already have pruned this project's labelled bridge.
        const remaining = capture(
          "docker",
          ["network", "ls", "--no-trunc", "-q"],
          { env },
        )
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        if (remaining.includes(networkId)) {
          assertOwnedNetwork(
            JSON.parse(
              capture("docker", ["network", "inspect", networkId], { env }),
            )[0],
            spec,
            networkId,
          );
          capture("docker", ["network", "rm", networkId], { env });
        }
        report.networkCleanup = "owned-network-removed";
      } catch {
        report.networkCleanup = "failed";
        report.status = "FAIL";
      }
    }
    process.off("SIGINT", signal);
    process.off("SIGTERM", signal);
    report.observedAt = new Date().toISOString();
    report.timingsMs[report.phase] = Date.now() - phaseStarted;
    report.totalMs = Date.now() - started;
    writeFileSync(summaryPath, JSON.stringify(report, null, 2));
    // Private raw logs, fixture passwords and auth responses are never printed/uploaded.
    console.log(
      `Disposable admin integration: ${report.status}; phase=${report.phase}. Sanitized summary: reports/admin-integration-summary.json`,
    );
  }
  return report.status === "PASS" ? 0 : 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await runAdminIntegration();
}
