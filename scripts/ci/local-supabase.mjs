// Configuration validation only. No CLI, filesystem, DNS, fetch, subprocess,
// service lifecycle, migration, seed or reset operation belongs in this module.

const LOOPBACK_HOST = "(127\\.0\\.0\\.1|localhost|\\[::1\\])";
const EXPLICIT_PORT = "([1-9][0-9]{0,4})";
const API_ORIGIN = new RegExp(`^http://${LOOPBACK_HOST}:${EXPLICIT_PORT}/?$`);
const DATABASE_DSN = new RegExp(
  `^postgresql://postgres:postgres@${LOOPBACK_HOST}:${EXPLICIT_PORT}/postgres$`,
);

function fail(message) {
  // Never include rejected values: URLs, DSNs and tokens may contain secrets.
  throw new Error(message);
}

function rawEndpoint(value, pattern, message) {
  // URL() normalizes numeric IPs, encoded hosts, dot paths and whitespace.
  // Restrict the original string before asking the parser to confirm it.
  if (
    typeof value !== "string" ||
    /[^\x21-\x7e]/.test(value) ||
    !pattern.test(value)
  ) {
    fail(message);
  }
  const match = pattern.exec(value);
  const port = Number(match[2]);
  if (port > 65535) fail(message);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(message);
  }
  if (parsed.hostname !== match[1] || parsed.port !== match[2]) fail(message);
  return parsed;
}

/** Return an HTTP loopback API origin. Explicit HTTP default port 80 is denied. */
export function assertLocalSupabase(value) {
  const message = "Expected an explicit loopback HTTP API origin";
  const parsed = rawEndpoint(value, API_ORIGIN, message);
  if (
    parsed.protocol !== "http:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    fail(message);
  }
  return parsed.origin;
}

/** Accept only the default disposable local CLI DB identity, with explicit port. */
export function assertLocalDatabaseUrl(value) {
  const message = "Expected an explicit disposable loopback Postgres DSN";
  const parsed = rawEndpoint(value, DATABASE_DSN, message);
  if (
    parsed.protocol !== "postgresql:" ||
    parsed.username !== "postgres" ||
    parsed.password !== "postgres" ||
    parsed.pathname !== "/postgres" ||
    parsed.search ||
    parsed.hash
  ) {
    fail(message);
  }
  return parsed.href;
}

function record(value, allowedKeys, message) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(message);
  // Inspect descriptors so even a getter on an ignored field cannot run.
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key in value) {
    if (!Object.hasOwn(value, key)) fail(message);
  }
  for (const key of Reflect.ownKeys(descriptors)) {
    if (
      typeof key !== "string" ||
      (allowedKeys && !allowedKeys.includes(key)) ||
      !Object.hasOwn(descriptors[key], "value")
    ) {
      fail(message);
    }
  }
  return value;
}

function requireOwnFields(value, keys, message) {
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) fail(message);
  }
}

function rejectInheritedCredentials(env) {
  const message = "Inherited credentials or backend settings are forbidden";
  record(env, null, message);
  const sensitive =
    /SUPABASE|POSTGRES|DATABASE|(?:^|_)(?:SB|DB|PG[A-Z0-9_]*|KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS?|AUTH|SERVICE_ROLE)(?:_|$)|^(?:API_URL|DIRECT_URL|ADMIN_EMAIL|(?:HTTP|HTTPS|ALL|NO)_PROXY)$/i;
  for (const key of Object.getOwnPropertyNames(env)) {
    if (sensitive.test(key) || typeof env[key] !== "string") fail(message);
  }
}

function decodeJsonPart(part) {
  const bytes = Buffer.from(part, "base64url");
  if (bytes.toString("base64url") !== part) fail("Invalid local anonymous key");
  return JSON.parse(bytes.toString("utf8"));
}

function assertLocalAnonKey(key, projectId) {
  const message = "Invalid local anonymous key";
  if (
    typeof key !== "string" ||
    key.length > 16384 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)
  ) {
    fail(message);
  }
  try {
    const [headerPart, payloadPart, signature] = key.split(".");
    const header = record(decodeJsonPart(headerPart), ["alg", "typ"], message);
    const claims = record(
      decodeJsonPart(payloadPart),
      ["iss", "role", "exp", "iat", "ref"],
      message,
    );
    const bytes = Buffer.from(signature, "base64url");
    if (
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      bytes.length !== 32 ||
      bytes.toString("base64url") !== signature ||
      claims.role !== "anon" ||
      claims.iss !== "supabase-demo" ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= 0 ||
      (Object.hasOwn(claims, "iat") &&
        (!Number.isSafeInteger(claims.iat) || claims.iat < 0)) ||
      (Object.hasOwn(claims, "ref") && claims.ref !== projectId)
    ) {
      fail(message);
    }
  } catch {
    fail(message);
  }
  // Claims and signature shape are checked, NOT the signature, expiry or backend.
  return key;
}

/**
 * Build app settings from an explicit CLI-status projection and caller provenance.
 * This is NOT ownership attestation or permission to execute against a service.
 * No defaults read process.env; inheritedEnv must be supplied explicitly.
 */
export function buildLocalSupabaseEnv(options) {
  const message = "Invalid explicit local Supabase configuration";
  const fields = ["status", "provenance", "inheritedEnv"];
  record(options, fields, message);
  requireOwnFields(options, fields, message);
  rejectInheritedCredentials(options.inheritedEnv);

  const statusFields = ["API_URL", "DB_URL", "ANON_KEY"];
  const status = record(options.status, statusFields, message);
  requireOwnFields(status, statusFields, message);
  const provenanceFields = [
    "marker",
    "source",
    "projectId",
    "runId",
    "apiUrl",
    "dbUrl",
  ];
  const provenance = record(options.provenance, provenanceFields, message);
  requireOwnFields(provenance, provenanceFields, message);
  if (
    provenance.marker !== "task4-owned-disposable-local" ||
    provenance.source !== "supabase-status-json" ||
    typeof provenance.projectId !== "string" ||
    !/^task4-[a-z0-9][a-z0-9-]{0,57}$/.test(provenance.projectId) ||
    typeof provenance.runId !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(provenance.runId) ||
    /[^\x21-\x7e]/.test(provenance.projectId + provenance.runId)
  ) {
    fail(message);
  }

  const apiUrl = assertLocalSupabase(status.API_URL);
  const dbUrl = assertLocalDatabaseUrl(status.DB_URL);
  if (
    apiUrl !== assertLocalSupabase(provenance.apiUrl) ||
    dbUrl !== assertLocalDatabaseUrl(provenance.dbUrl)
  ) {
    fail("CLI status does not match the declared local ownership endpoints");
  }
  return Object.freeze({
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: assertLocalAnonKey(
      status.ANON_KEY,
      provenance.projectId,
    ),
    ADMIN_EMAIL: "task4-admin@example.invalid",
  });
}
