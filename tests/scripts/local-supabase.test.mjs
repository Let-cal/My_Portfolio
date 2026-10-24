import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

const moduleUrl = new URL(
  "../../scripts/ci/local-supabase.mjs",
  import.meta.url,
);
const api = await import(moduleUrl.href).catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && error.url === moduleUrl.href) {
    return {};
  }
  throw error;
});

function exported(name) {
  assert.equal(typeof api[name], "function", `Missing safety export: ${name}`);
  return api[name];
}

// Assert outside assert.throws: a missing export must not make a rejection pass.
beforeEach(() => {
  exported("assertLocalSupabase");
  exported("assertLocalDatabaseUrl");
  exported("buildLocalSupabaseEnv");
});

// These unsigned-by-a-real-service fixtures exercise syntax/claim filtering only.
// They never connect to Supabase and are not integration/authentication evidence.
function token(claims = {}, header = { alg: "HS256", typ: "JWT" }) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return [
    encode(header),
    encode({ iss: "supabase-demo", role: "anon", exp: 1983812996, ...claims }),
    Buffer.alloc(32, 1).toString("base64url"),
  ].join(".");
}

function input() {
  return {
    status: {
      API_URL: "http://127.0.0.1:54321",
      DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      ANON_KEY: token(),
    },
    provenance: {
      marker: "task4-owned-disposable-local",
      source: "supabase-status-json",
      projectId: "task4-safety",
      runId: "synthetic-run-1",
      apiUrl: "http://127.0.0.1:54321",
      dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
    inheritedEnv: {},
  };
}

test("exports configuration validation without an execution API", () => {
  assert.deepEqual(Object.keys(api).sort(), [
    "assertLocalDatabaseUrl",
    "assertLocalSupabase",
    "buildLocalSupabaseEnv",
  ]);
});

const acceptedApis = [
  ["http://127.0.0.1:54321", "http://127.0.0.1:54321"],
  ["http://127.0.0.1:54321/", "http://127.0.0.1:54321"],
  ["http://localhost:54321", "http://localhost:54321"],
  ["http://[::1]:54321/", "http://[::1]:54321"],
  ["http://localhost:1", "http://localhost:1"],
  ["http://localhost:65535", "http://localhost:65535"],
];
for (const [value, expected] of acceptedApis) {
  test(`accepts explicit loopback API origin ${value}`, () => {
    assert.equal(exported("assertLocalSupabase")(value), expected);
  });
}

const rejectedApis = [
  undefined,
  null,
  0,
  {},
  new URL("http://localhost:54321"),
  "",
  "https://project.supabase.co",
  "http://project.supabase.co:54321",
  "http://localhost.supabase.co:54321",
  "http://localhost.evil.invalid:54321",
  "http://localhost.:54321",
  "http://LOCALHOST:54321",
  "http://localhοst:54321",
  "http://local%68ost:54321",
  "http://%31%32%37.0.0.1:54321",
  "http://127.0.0.1.nip.io:54321",
  "http://127.0.0.2:54321",
  "http://0.0.0.0:54321",
  "http://192.168.1.2:54321",
  "http://169.254.169.254:54321",
  "http://127.1:54321",
  "http://127.0.1:54321",
  "http://2130706433:54321",
  "http://0177.0.0.1:54321",
  "http://127.000.000.001:54321",
  "http://0x7f000001:54321",
  "http://0x7f.0.0.1:54321",
  "http://[0:0:0:0:0:0:0:1]:54321",
  "http://[::ffff:127.0.0.1]:54321",
  "http://[::]:54321",
  "http://[fe80::1%25lo0]:54321",
  "https://localhost:54321",
  "ftp://localhost:54321",
  "file://localhost:54321",
  "//localhost:54321",
  "http:localhost:54321",
  "http:/localhost:54321",
  "HTTP://localhost:54321",
  "http://localhost",
  "http://localhost/",
  "http://localhost:",
  "http://localhost:0",
  "http://localhost:80",
  "http://localhost:00080",
  "http://localhost:054321",
  "http://localhost:65536",
  "http://localhost:+54321",
  "http://localhost:5e4",
  "http://user@localhost:54321",
  "http://user:password@localhost:54321",
  "http://@localhost:54321",
  "http://localhost:54321@evil.invalid",
  "http://evil.invalid@localhost:54321",
  "http://localhost:54321@localhost:54321",
  "http://localhost:54321/rest/v1",
  "http://localhost:54321//",
  "http://localhost:54321/.",
  "http://localhost:54321/../",
  "http://localhost:54321/%2e%2e",
  "http://localhost:54321?",
  "http://localhost:54321/?host=evil.invalid",
  "http://localhost:54321#",
  "http://localhost:54321/#fragment",
  "http://localhost:54321\\@evil.invalid",
  " http://localhost:54321",
  "http://localhost:54321 ",
  "http://local\thost:54321",
  "http://local\nhost:54321",
  "http://localhost:54321\n",
  "http://localhost:54321\r",
  "http://localhost:54321\0",
  "\uFEFFhttp://localhost:54321",
  "http://localhost:54321\u00a0",
];
for (const [index, value] of rejectedApis.entries()) {
  test(`rejects ambiguous or remote API input ${index}`, () => {
    assert.throws(() => exported("assertLocalSupabase")(value));
  });
}

for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
  test(`accepts explicit local Postgres DSN for ${host}`, () => {
    const value = `postgresql://postgres:postgres@${host}:54322/postgres`;
    assert.equal(exported("assertLocalDatabaseUrl")(value), value);
  });
}

const rejectedDbs = [
  undefined,
  null,
  {},
  "",
  "host=localhost dbname=postgres",
  "postgresql://postgres:postgres@project.supabase.co:54322/postgres",
  "postgresql://postgres:postgres@localhost.evil.invalid:54322/postgres",
  "postgresql://postgres:postgres@127.1:54322/postgres",
  "postgresql://postgres:postgres@2130706433:54322/postgres",
  "postgresql://postgres:postgres@0x7f000001:54322/postgres",
  "postgresql://postgres:postgres@%6cocalhost:54322/postgres",
  "postgresql://postgres:postgres@localhost.:54322/postgres",
  "postgresql://postgres:postgres@LOCALHOST:54322/postgres",
  "postgresql://postgres:postgres@[::ffff:127.0.0.1]:54322/postgres",
  "postgresql://postgres:production-password@localhost:54322/postgres",
  "postgresql://production-user:postgres@localhost:54322/postgres",
  "postgresql://postgres.project-ref:postgres@localhost:54322/postgres",
  "postgresql://postgres:post%67res@localhost:54322/postgres",
  "postgresql://postgres@localhost:54322/postgres",
  "postgresql://postgres:postgres@localhost/postgres",
  "postgresql://postgres:postgres@localhost:0/postgres",
  "postgresql://postgres:postgres@localhost:054322/postgres",
  "postgresql://postgres:postgres@localhost:65536/postgres",
  "postgresql://postgres:postgres@localhost:54322/production",
  "postgresql://postgres:postgres@localhost:54322/postgres/",
  "postgresql://postgres:postgres@localhost:54322/other/../postgres",
  "postgresql://postgres:postgres@localhost:54322/postgres?host=evil.invalid",
  "postgresql://postgres:postgres@localhost:54322/postgres?hostaddr=1.2.3.4",
  "postgresql://postgres:postgres@localhost:54322/postgres?service=production",
  "postgresql://postgres:postgres@localhost:54322/postgres?options=-csearch_path=public",
  "postgresql://postgres:postgres@localhost:54322/postgres#fragment",
  "postgresql://postgres:postgres@localhost,evil.invalid:54322/postgres",
  "postgresql://postgres:postgres@localhost:54322@evil.invalid/postgres",
  "postgresql://postgres:postgres@localhost:54322\\evil.invalid/postgres",
  "postgres://postgres:postgres@localhost:54322/postgres",
  "https://postgres:postgres@localhost:54322/postgres",
  " postgresql://postgres:postgres@localhost:54322/postgres",
  "postgresql://postgres:postgres@localhost:54322/postgres\n",
];
for (const [index, value] of rejectedDbs.entries()) {
  test(`rejects remote, credential-bearing or ambiguous DB input ${index}`, () => {
    assert.throws(() => exported("assertLocalDatabaseUrl")(value));
  });
}

test("builds a fresh app-only allowlist without changing any input", () => {
  const value = input();
  value.inheritedEnv = {
    PATH: "synthetic-path",
    HOME: "synthetic-home",
    NODE_OPTIONS: "--require=untrusted",
    NODE_ENV: "production",
    ADMIN_UNRELATED: "discard",
    ARBITRARY: "discard",
  };
  const before = structuredClone(value);
  const result = exported("buildLocalSupabaseEnv")(value);
  assert.deepEqual(result, {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: token(),
    ADMIN_EMAIL: "task4-admin@example.invalid",
  });
  assert.deepEqual(value, before);
  assert.ok(Object.isFrozen(result));
  assert.notEqual(result, exported("buildLocalSupabaseEnv")(value));
});

test("allows a root slash and a matching optional local JWT ref", () => {
  const value = input();
  value.status.API_URL += "/";
  value.status.ANON_KEY = token({ ref: "task4-safety" });
  assert.equal(
    exported("buildLocalSupabaseEnv")(value).NEXT_PUBLIC_SUPABASE_URL,
    "http://127.0.0.1:54321",
  );
});

for (const host of ["localhost", "[::1]"]) {
  test(`builds a bound configuration using ${host}`, () => {
    const value = input();
    value.status.API_URL = value.provenance.apiUrl = `http://${host}:54321`;
    value.status.DB_URL =
      value.provenance.dbUrl = `postgresql://postgres:postgres@${host}:54322/postgres`;
    assert.equal(
      exported("buildLocalSupabaseEnv")(value).NEXT_PUBLIC_SUPABASE_URL,
      `http://${host}:54321`,
    );
  });
}

const inheritedNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_SERVICES_HOSTNAME",
  "SB_SECRET_KEY",
  "SERVICE_ROLE_KEY",
  "API_URL",
  "DATABASE_URL",
  "DIRECT_URL",
  "DB_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "PGHOST",
  "PGHOSTADDR",
  "PGPORT",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
  "PGSERVICE",
  "PGSERVICEFILE",
  "PGPASSFILE",
  "PGOPTIONS",
  "PGSSLMODE",
  "JWT_SECRET",
  "ANON_KEY",
  "PUBLISHABLE_KEY",
  "SECRET_KEY",
  "ACCESS_TOKEN",
  "AWS_ACCESS_KEY_ID",
  "GITHUB_TOKEN",
  "VERCEL_TOKEN",
  "OPENAI_API_KEY",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "ADMIN_EMAIL",
  "next_public_supabase_url",
  "supabase_access_token",
  "pgpassword",
  "Database_Url",
];
for (const name of inheritedNames) {
  test(`rejects inherited sensitive setting ${name} instead of overwriting it`, () => {
    const value = input();
    value.inheritedEnv[name] = "inherited-secret-sentinel";
    assert.throws(
      () => exported("buildLocalSupabaseEnv")(value),
      (error) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes("inherited-secret-sentinel"));
        return true;
      },
    );
  });
}

test("rejects inherited local Supabase settings too", () => {
  const value = input();
  value.inheritedEnv.NEXT_PUBLIC_SUPABASE_URL = value.status.API_URL;
  assert.throws(() => exported("buildLocalSupabaseEnv")(value));
});
test("rejects empty sensitive inherited settings", () => {
  const value = input();
  value.inheritedEnv.SUPABASE_ACCESS_TOKEN = "";
  assert.throws(() => exported("buildLocalSupabaseEnv")(value));
});
test("rejects inherited enumerable credentials and getters without evaluating them", () => {
  const value = input();
  value.inheritedEnv = Object.create({
    SUPABASE_ACCESS_TOKEN: "hidden-secret",
  });
  assert.throws(() => exported("buildLocalSupabaseEnv")(value));
  let reads = 0;
  value.inheritedEnv = Object.defineProperty({}, "PATH", {
    get() {
      reads++;
      return "not-used";
    },
    enumerable: true,
  });
  assert.throws(() => exported("buildLocalSupabaseEnv")(value));
  assert.equal(reads, 0);
});

for (const field of ["status", "provenance", "inheritedEnv"]) {
  for (const bad of [undefined, null, [], "not-an-object"]) {
    test(`requires explicit ${field} record: ${JSON.stringify(bad)}`, () => {
      const value = input();
      value[field] = bad;
      assert.throws(() => exported("buildLocalSupabaseEnv")(value));
    });
  }
}
for (const field of ["API_URL", "DB_URL", "ANON_KEY"]) {
  test(`requires status ${field}`, () => {
    const value = input();
    delete value.status[field];
    assert.throws(() => exported("buildLocalSupabaseEnv")(value));
  });
}
for (const [field, bad] of [
  ["marker", undefined],
  ["marker", true],
  ["marker", "owned"],
  ["source", "environment"],
  ["source", "hosted-dashboard"],
  ["projectId", "hosted-ref"],
  ["projectId", "task4-"],
  ["runId", ""],
  ["runId", "../another-run"],
  ["runId", "run\n"],
  ["apiUrl", "http://127.0.0.1:54320"],
  ["apiUrl", "http://localhost:54321"],
  ["apiUrl", "https://project.supabase.co"],
  ["dbUrl", "postgresql://postgres:postgres@127.0.0.1:54323/postgres"],
  [
    "dbUrl",
    "postgresql://postgres:postgres@project.supabase.co:54322/postgres",
  ],
]) {
  test(`rejects absent, unbound or malformed provenance ${field}: ${JSON.stringify(bad)}`, () => {
    const value = input();
    value.provenance[field] = bad;
    assert.throws(() => exported("buildLocalSupabaseEnv")(value));
  });
}

test("validates status endpoints independently of the ownership claim", () => {
  for (const field of ["API_URL", "DB_URL"]) {
    const value = input();
    value.status[field] = "https://project.supabase.co";
    assert.throws(() => exported("buildLocalSupabaseEnv")(value));
  }
});

for (const [section, field] of [
  ["status", "SERVICE_ROLE_KEY"],
  ["status", "JWT_SECRET"],
  ["status", "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"],
  ["status", "UNKNOWN_URL"],
  ["provenance", "allowRemote"],
  [null, "env"],
  [null, "serviceRoleKey"],
]) {
  test(`rejects unallowlisted configuration field ${section ?? "root"}.${field}`, () => {
    const value = input();
    (section ? value[section] : value)[field] = "discard-me";
    assert.throws(() => exported("buildLocalSupabaseEnv")(value));
  });
}

const badTokens = [
  undefined,
  null,
  {},
  "",
  "not-a-token",
  "sb_secret_synthetic",
  "sb_publishable_synthetic",
  token({ role: "service_role" }),
  token({ role: "authenticated" }),
  token({ iss: "https://project.supabase.co/auth/v1" }),
  token({ iss: "supabase" }),
  token({ ref: "hosted-project-ref" }),
  token({ ref: null }),
  token({ iss: null }),
  token({ role: null }),
  token({ exp: "1983812996" }),
  token({ exp: -1 }),
  token({}, { alg: "none", typ: "JWT" }),
  token({}, { alg: "RS256", typ: "JWT" }),
  `${token()} `,
  `${token()}\n`,
  `${token()}.extra`,
  token().replace(/.$/, "="),
  "e30.bm90LWpzb24.AAAA",
  "e30.W10.AAAA",
  "x".repeat(17000),
];
for (const [index, value] of badTokens.entries()) {
  test(`rejects malformed or nonlocal anonymous key ${index}`, () => {
    const config = input();
    config.status.ANON_KEY = value;
    assert.throws(() => exported("buildLocalSupabaseEnv")(config));
  });
}

test("validation errors do not echo API/DSN/key credentials", () => {
  const sentinel = "private-credential-sentinel";
  const cases = [
    () => exported("assertLocalSupabase")(`http://${sentinel}@localhost:54321`),
    () =>
      exported("assertLocalDatabaseUrl")(
        `postgresql://postgres:${sentinel}@localhost:54322/postgres`,
      ),
    () =>
      exported("buildLocalSupabaseEnv")({
        ...input(),
        status: { ...input().status, ANON_KEY: sentinel },
      }),
  ];
  for (const action of cases) {
    assert.throws(action, (error) => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes(sentinel));
      return true;
    });
  }
});
