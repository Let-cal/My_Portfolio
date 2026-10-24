import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readTask4Settings, localOnlyProxy } from "../e2e-admin/settings";

// Keep real filesystem operations, allowing only deterministic race injection.
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
}));

const {
  fstatSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = await vi.importActual<typeof import("node:fs")>("node:fs");

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
  vi.unstubAllGlobals();
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
  for (const replacementPoint of ["after open", "before read"] as const)
    it(`validates and reads the same descriptor when the path is replaced ${replacementPoint}`, () => {
      const heldPath = join(sandbox, ".superpowers/held.json");
      const replacement = { ...fixture(), runId: "124" };
      let opened: number | undefined;
      let inspected: number | undefined;
      let read: number | undefined;
      let identity: { dev: number; ino: number } | undefined;
      const replacePath = () => {
        renameSync(fixturePath, heldPath);
        writeFileSync(fixturePath, JSON.stringify(replacement), {
          mode: 0o600,
        });
      };
      vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => {
        opened = openSync(path, flags, mode);
        if (replacementPoint === "after open") replacePath();
        return opened;
      });
      vi.spyOn(fs, "fstatSync").mockImplementation((fd) => {
        inspected = fd;
        const stat = fstatSync(fd);
        identity = { dev: stat.dev, ino: stat.ino };
        return stat;
      });
      vi.spyOn(fs, "readFileSync").mockImplementation((path, options) => {
        if (replacementPoint === "before read") replacePath();
        if (typeof path === "number") {
          read = path;
          // Assert identity at the read boundary, before consuming any bytes.
          expect(path).toBe(inspected);
          const stat = fstatSync(path);
          expect({ dev: stat.dev, ino: stat.ino }).toEqual(identity);
        }
        return readFileSync(path, options);
      });

      expect(
        readTask4Settings({ ...env(), TASK4_RUN_ID: undefined }).runId,
      ).toBe("123");
      expect(opened).toBeTypeOf("number");
      expect(inspected).toBe(opened);
      expect(read).toBe(opened);
      expect(JSON.parse(readFileSync(fixturePath, "utf8")).runId).toBe("124");
      expect(() => fstatSync(opened!)).toThrow(/EBADF/);
    });
  it.each([0, 16_385])("rejects fixture size %i before reading", (size) => {
    writeFileSync(fixturePath, " ".repeat(size));
    const read = vi.spyOn(fs, "readFileSync");
    expect(() => readTask4Settings(env())).toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it("rejects a hard-linked fixture before reading", () => {
    linkSync(fixturePath, join(sandbox, "linked.json"));
    const read = vi.spyOn(fs, "readFileSync");
    expect(() => readTask4Settings(env())).toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it("rejects a directory before reading", () => {
    renameSync(fixturePath, join(sandbox, "held.json"));
    mkdirSync(fixturePath);
    const read = vi.spyOn(fs, "readFileSync");
    expect(() => readTask4Settings(env())).toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it.each([
    { mode: 0o644, uid: 1234 },
    { mode: 0o4600, uid: 1234 },
    { mode: 0o600, uid: 5678 },
  ])(
    "rejects Linux descriptor metadata $mode/$uid before reading",
    (metadata) => {
      // Exercise Linux policy on every host; keep descriptor I/O real.
      vi.stubGlobal("process", {
        ...process,
        platform: "linux",
        getuid: () => 1234,
      });
      let opened: number | undefined;
      vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => {
        opened = openSync(path, flags, mode);
        return opened;
      });
      vi.spyOn(fs, "fstatSync").mockImplementation((fd) => {
        const stat = fstatSync(fd);
        return Object.assign(stat, {
          mode: (stat.mode & ~0o7777) | metadata.mode,
          uid: metadata.uid,
        });
      });
      const read = vi.spyOn(fs, "readFileSync");
      expect(() => readTask4Settings(env())).toThrow();
      expect(read).not.toHaveBeenCalled();
      expect(opened).toBeTypeOf("number");
      expect(() => fstatSync(opened!)).toThrow(/EBADF/);
    },
  );
  it("accepts a Linux descriptor owned by the current UID with mode 0600", () => {
    vi.stubGlobal("process", {
      ...process,
      platform: "linux",
      getuid: () => 1234,
    });
    vi.spyOn(fs, "fstatSync").mockImplementation((fd) => {
      const stat = fstatSync(fd);
      return Object.assign(stat, {
        mode: (stat.mode & ~0o7777) | 0o600,
        uid: 1234,
      });
    });
    expect(readTask4Settings(env()).runId).toBe("123");
  });
  it("rejects a private directory redirected away from the fixed real path", () => {
    const privatePath = join(sandbox, ".superpowers");
    const redirected = join(sandbox, "redirected");
    renameSync(privatePath, redirected);
    symlinkSync(
      redirected,
      privatePath,
      process.platform === "win32" ? "junction" : "dir",
    );
    const read = vi.spyOn(fs, "readFileSync");
    expect(() => readTask4Settings(env())).toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it.skipIf(process.platform === "win32")(
    "refuses a symbolic link at the fixed private path",
    () => {
      const heldPath = join(sandbox, "held.json");
      renameSync(fixturePath, heldPath);
      symlinkSync(heldPath, fixturePath);
      const read = vi.spyOn(fs, "readFileSync");
      expect(() => readTask4Settings(env())).toThrow();
      expect(read).not.toHaveBeenCalled();
    },
  );
  it.skipIf(process.platform !== "linux")(
    "uses O_NOFOLLOW when a symlink replaces the fixture just before open",
    () => {
      const heldPath = join(sandbox, "held.json");
      vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => {
        renameSync(fixturePath, heldPath);
        symlinkSync(heldPath, fixturePath);
        // The actual kernel open must reject the symlink, before metadata/read.
        return openSync(path, flags, mode);
      });
      const stat = vi.spyOn(fs, "fstatSync");
      const read = vi.spyOn(fs, "readFileSync");
      expect(() => readTask4Settings(env())).toThrow();
      expect(stat).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
    },
  );
  it("closes the descriptor when fixture parsing fails", () => {
    writeFileSync(fixturePath, "{");
    let opened: number | undefined;
    vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => {
      opened = openSync(path, flags, mode);
      return opened;
    });
    expect(() => readTask4Settings(env())).toThrow();
    expect(opened).toBeTypeOf("number");
    expect(() => fstatSync(opened!)).toThrow(/EBADF/);
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
