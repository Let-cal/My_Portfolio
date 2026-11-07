import { describe, expect, it } from "vitest";
import { isFixtureProbe } from "../e2e-admin/fixtures";

// The disposable-DB browser harness may call only these local endpoints.
describe("disposable admin harness probe allowlist", () => {
  it.each([
    "/rest/v1/certificates?id=eq.task4-a&select=*",
    "/rest/v1/projects?id=eq.task4-project-figures",
    "/rest/v1/projects?id=eq.task4-project-figures&select=id,published,media",
    "/storage/v1/object/list/media",
    "/storage/v1/object/media",
    "/storage/v1/object/public/media/image/abc12345-task4-figure.webp",
    "/storage/v1/object/public/media/diagram/task4-project-figures-fig-a1-light-0123abcd.svg",
  ])("allows %s", (path) => expect(isFixtureProbe(path)).toBe(true));

  it.each([
    "/rest/v1/projects",
    "/rest/v1/projects?id=eq.siteplus",
    "/rest/v1/projects?id=eq.task4-project-figuresx",
    "/rest/v1/profile",
    "/storage/v1/object/files",
    "/storage/v1/object/list/files",
    "/storage/v1/object/public/media/other/x.png",
    "/storage/v1/object/public/media/image/../diagram/x.svg",
    "/storage/v1/object/public/files/image/x.png",
    "/storage/v1/bucket/media",
    "/auth/v1/admin/users",
  ])("refuses %s", (path) => expect(isFixtureProbe(path)).toBe(false));
});
