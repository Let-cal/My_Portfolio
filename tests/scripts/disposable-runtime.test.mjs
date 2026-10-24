import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
const moduleUrl = new URL(
  "../../scripts/ci/disposable-runtime.mjs",
  import.meta.url,
);
const api = await import(moduleUrl.href).catch((e) => {
  if (e.code === "ERR_MODULE_NOT_FOUND" && e.url === moduleUrl.href) return {};
  throw e;
});
const spec = () =>
  api.createRunSpec(
    { runId: "12345", attempt: "1", nonce: "aabbccdd" },
    "linux",
  );
test("exports explicit runtime ownership and environment boundaries", () => {
  for (const key of [
    "createRunSpec",
    "isolatedProcessEnv",
    "assertOwnedContainers",
  ])
    assert.equal(typeof api[key], "function", key);
});
test("launcher rejects parent hooks, hosted credentials and proxy settings", () => {
  assert.equal(typeof api.assertSanitizedLauncherEnv, "function");
  api.assertSanitizedLauncherEnv({ PATH: "/usr/bin", GITHUB_ACTIONS: "true" });
  for (const key of [
    "NODE_OPTIONS",
    "HTTPS_PROXY",
    "SUPABASE_ACCESS_TOKEN",
    "NEXT_PUBLIC_SUPABASE_URL",
    "GITHUB_TOKEN",
  ])
    assert.throws(() =>
      api.assertSanitizedLauncherEnv({ PATH: "/usr/bin", [key]: "sentinel" }),
    );
});
test("accepts only a Linux run identity with a fresh nonce", () => {
  assert.equal(spec().projectId, "task4-12345-1-aabbccdd");
  assert.equal(spec().apiUrl, "http://127.0.0.1:55321");
  for (const value of ["", "../prod", "abc", "12\n"])
    assert.throws(() =>
      api.createRunSpec(
        { runId: value, attempt: "1", nonce: "aabbccdd" },
        "linux",
      ),
    );
  for (const platform of ["win32", "darwin"])
    assert.throws(() =>
      api.createRunSpec(
        { runId: "123", attempt: "1", nonce: "aabbccdd" },
        platform,
      ),
    );
});
test("child process environment does not inherit credentials, hooks, proxies or host config", () => {
  const env = api.isolatedProcessEnv(
    {
      PATH: "/usr/bin",
      HOME: "/original",
      SUPABASE_ACCESS_TOKEN: "hosted-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://hosted.supabase.co",
      NODE_OPTIONS: "--require=bad",
      HTTPS_PROXY: "http://bad",
      GITHUB_TOKEN: "token",
    },
    "/owned/home",
  );
  assert.deepEqual(env, {
    PATH: "/usr/bin",
    HOME: "/owned/home",
    XDG_CONFIG_HOME: "/owned/home/.config",
    TMPDIR: "/owned/home/tmp",
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    DOCKER_HOST: "unix:///var/run/docker.sock",
  });
});
function containers() {
  const s = spec();
  return [
    {
      Id: "a".repeat(64),
      Name: `/supabase_db_${s.projectId}`,
      Config: { Labels: { "com.supabase.cli.project": s.projectId } },
      State: { Running: true },
      NetworkSettings: {
        Ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55322" }] },
      },
    },
    {
      Id: "b".repeat(64),
      Name: `/supabase_kong_${s.projectId}`,
      Config: { Labels: { "com.supabase.cli.project": s.projectId } },
      State: { Running: true },
      NetworkSettings: {
        Ports: { "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: "55321" }] },
      },
    },
  ];
}
test("owned bridge requires exact ID, namespace and loopback default", () => {
  const id = "c".repeat(64),
    s = spec();
  const network = {
    Id: id,
    Name: `task4-net-${s.projectId}`,
    Driver: "bridge",
    Labels: { "com.supabase.cli.project": s.projectId },
    Options: { "com.docker.network.bridge.host_binding_ipv4": "127.0.0.1" },
  };
  api.assertOwnedNetwork(network, s, id);
  for (const patch of [
    { Id: "d".repeat(64) },
    { Name: "another" },
    { Driver: "host" },
    { Labels: {} },
    { Options: {} },
    { Options: { "com.docker.network.bridge.host_binding_ipv4": "0.0.0.0" } },
  ])
    assert.throws(() =>
      api.assertOwnedNetwork({ ...network, ...patch }, s, id),
    );
});
test("attests current uniquely named DB and API containers with matching labels and ports", () => {
  const c = containers();
  assert.equal(api.assertOwnedContainers(c, spec()).databaseId, c[0].Id);
});
test("verifies both local JWT signatures and rejects a key from another stack", () => {
  assert.equal(typeof api.validateLocalStatus, "function");
  const secret = "a".repeat(40),
    s = spec();
  const token = (role, key = secret) => {
    const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const data = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ iss: "supabase-demo", role, exp: 1983812996 })}`;
    return `${data}.${createHmac("sha256", key).update(data).digest("base64url")}`;
  };
  const status = {
    API_URL: s.apiUrl,
    DB_URL: s.dbUrl,
    ANON_KEY: token("anon"),
    SERVICE_ROLE_KEY: token("service_role"),
    JWT_SECRET: secret,
  };
  assert.equal(
    api.validateLocalStatus(status, s).ADMIN_EMAIL,
    "task4-admin@example.invalid",
  );
  for (const field of ["ANON_KEY", "SERVICE_ROLE_KEY"])
    assert.throws(() =>
      api.validateLocalStatus(
        {
          ...status,
          [field]: token(
            field === "ANON_KEY" ? "anon" : "service_role",
            "wrong".repeat(8),
          ),
        },
        s,
      ),
    );
  assert.throws(() =>
    api.validateLocalStatus(
      { ...status, API_URL: "https://remote.supabase.co" },
      s,
    ),
  );
});
for (const [name, mutate] of [
  [
    "wrong label",
    (c) => (c[0].Config.Labels["com.supabase.cli.project"] = "another"),
  ],
  ["wrong name", (c) => (c[0].Name = "/supabase_db_unrelated")],
  ["stopped database", (c) => (c[0].State.Running = false)],
  [
    "forwarded database port",
    (c) => (c[0].NetworkSettings.Ports["5432/tcp"][0].HostPort = "54322"),
  ],
  ["missing API", (c) => c.pop()],
  ["duplicate container", (c) => c.push(c[0])],
  ["invalid container ID", (c) => (c[0].Id = "--unrelated")],
  ...["0.0.0.0", "::", "::1", "192.168.1.10", ""].map((ip) => [
    `non-approved database binding ${ip || "empty"}`,
    (c) => (c[0].NetworkSettings.Ports["5432/tcp"][0].HostIp = ip),
  ]),
  [
    "public API binding",
    (c) => (c[1].NetworkSettings.Ports["8000/tcp"][0].HostIp = "0.0.0.0"),
  ],
  [
    "additional public port",
    (c) =>
      (c[1].NetworkSettings.Ports["8443/tcp"] = [
        { HostIp: "0.0.0.0", HostPort: "55324" },
      ]),
  ],
])
  test(`rejects ${name} before database access`, () => {
    const c = containers();
    mutate(c);
    assert.throws(() => api.assertOwnedContainers(c, spec()));
  });
