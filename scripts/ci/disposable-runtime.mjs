import { createHmac, timingSafeEqual } from "node:crypto";
import { buildLocalSupabaseEnv } from "./local-supabase.mjs";

export function assertSanitizedLauncherEnv(env) {
  const allowed = new Set([
    "PATH",
    "HOME",
    "TMPDIR",
    "CI",
    "NEXT_TELEMETRY_DISABLED",
    "GITHUB_ACTIONS",
    "RUNNER_ENVIRONMENT",
    "GITHUB_SHA",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
  ]);
  if (Object.keys(env).some((key) => !allowed.has(key)))
    throw new Error("Launcher requires an explicit clean process environment");
}

// Pure consistency checks. Actual ownership also requires a private fresh workspace,
// an empty pre-start Docker resource inventory and launching the pinned CLI there.
export function createRunSpec({ runId, attempt, nonce }, platform) {
  if (
    platform !== "linux" ||
    !/^[1-9][0-9]{0,19}$/.test(runId ?? "") ||
    !/^[1-9][0-9]{0,4}$/.test(attempt ?? "") ||
    !/^[a-f0-9]{8}$/.test(nonce ?? "")
  ) {
    throw new Error("Expected an explicit disposable Linux run identity");
  }
  return Object.freeze({
    projectId: `task4-${runId}-${attempt}-${nonce}`,
    runId,
    apiUrl: "http://127.0.0.1:55321",
    dbUrl: "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
    appOrigin: "http://127.0.0.1:4327",
  });
}

export function isolatedProcessEnv(parent, home) {
  if (
    typeof parent?.PATH !== "string" ||
    !parent.PATH ||
    typeof home !== "string" ||
    !home.startsWith("/") ||
    /[\r\n\0]/.test(home)
  ) {
    throw new Error("Expected a private Linux process environment");
  }
  return {
    PATH: parent.PATH,
    HOME: home,
    XDG_CONFIG_HOME: `${home}/.config`,
    TMPDIR: `${home}/tmp`,
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    DOCKER_HOST: "unix:///var/run/docker.sock",
  };
}

export function assertOwnedContainers(containers, spec) {
  if (
    !Array.isArray(containers) ||
    containers.length < 2 ||
    !/^task4-[0-9]+-[0-9]+-[a-f0-9]{8}$/.test(spec?.projectId ?? "")
  ) {
    throw new Error("Disposable container ownership was not established");
  }
  const ids = new Set();
  for (const c of containers) {
    if (
      !/^[a-f0-9]{64}$/.test(c?.Id ?? "") ||
      ids.has(c.Id) ||
      c.Config?.Labels?.["com.supabase.cli.project"] !== spec.projectId ||
      !c.Name?.endsWith(`_${spec.projectId}`) ||
      c.State?.Running !== true
    ) {
      throw new Error("Disposable container identity mismatch");
    }
    ids.add(c.Id);
    for (const bindings of Object.values(c.NetworkSettings?.Ports ?? {})) {
      if (bindings === null) continue;
      if (
        !Array.isArray(bindings) ||
        bindings.some((p) => p?.HostIp !== "127.0.0.1")
      )
        throw new Error(
          "Disposable service must publish only on IPv4 loopback",
        );
    }
  }
  const find = (service, port, hostPort) => {
    const rows = containers.filter(
      (c) => c.Name === `/supabase_${service}_${spec.projectId}`,
    );
    if (
      rows.length !== 1 ||
      !rows[0].NetworkSettings?.Ports?.[port]?.length ||
      rows[0].NetworkSettings.Ports[port].some((p) => p.HostPort !== hostPort)
    ) {
      throw new Error("Disposable service port mismatch");
    }
    return rows[0].Id;
  };
  return Object.freeze({
    databaseId: find("db", "5432/tcp", "55322"),
    apiId: find("kong", "8000/tcp", "55321"),
  });
}

export function assertOwnedNetwork(network, spec, expectedId) {
  if (
    !/^[a-f0-9]{64}$/.test(expectedId ?? "") ||
    network?.Id !== expectedId ||
    network.Name !== `task4-net-${spec.projectId}` ||
    network.Driver !== "bridge" ||
    network.Labels?.["com.supabase.cli.project"] !== spec.projectId ||
    network.Options?.["com.docker.network.bridge.host_binding_ipv4"] !==
      "127.0.0.1"
  )
    throw new Error("Disposable network ownership mismatch");
}

export function validateLocalStatus(status, spec) {
  const env = buildLocalSupabaseEnv({
    status: {
      API_URL: status.API_URL,
      DB_URL: status.DB_URL,
      ANON_KEY: status.ANON_KEY,
    },
    provenance: {
      marker: "task4-owned-disposable-local",
      source: "supabase-status-json",
      projectId: spec.projectId,
      runId: spec.runId,
      apiUrl: spec.apiUrl,
      dbUrl: spec.dbUrl,
    },
    inheritedEnv: {},
  });
  try {
    if (typeof status.JWT_SECRET !== "string" || status.JWT_SECRET.length < 32)
      throw new Error();
    for (const [key, role] of [
      [status.ANON_KEY, "anon"],
      [status.SERVICE_ROLE_KEY, "service_role"],
    ]) {
      if (typeof key !== "string" || key.length > 16384) throw new Error();
      const parts = key.split(".");
      if (parts.length !== 3) throw new Error();
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      if (
        header.alg !== "HS256" ||
        header.typ !== "JWT" ||
        claims.iss !== "supabase-demo" ||
        claims.role !== role ||
        !Number.isSafeInteger(claims.exp) ||
        claims.exp * 1000 <= Date.now() ||
        (claims.ref !== undefined && claims.ref !== spec.projectId)
      )
        throw new Error();
      const signature = Buffer.from(parts[2], "base64url");
      const expected = createHmac("sha256", status.JWT_SECRET)
        .update(`${parts[0]}.${parts[1]}`)
        .digest();
      if (
        signature.length !== expected.length ||
        !timingSafeEqual(signature, expected)
      )
        throw new Error();
    }
  } catch {
    throw new Error("Local stack key verification failed");
  }
  return env;
}
