import { describe, expect, it } from "vitest";
import { contentSchema, type Content, type Project } from "@/content/schema";
import seed from "@/content/seed.json";
import { publicPath, publicTarget, publicUrl } from "@/lib/admin/public-link";

const base = (): Content => contentSchema.parse(structuredClone(seed));

const personal = (over: Partial<Project>): Project => ({
  ...base().projects[0],
  kind: "personal",
  experienceId: null,
  educationId: null,
  featured: false,
  featuredOrder: null,
  ...over,
});

describe("publicTarget", () => {
  it("a stint points at its tree parent, not at the stint", () => {
    expect(publicTarget("experiences", "skg-intern", base())).toEqual({
      page: "home",
      anchor: "exp-skg-software",
    });
    expect(publicTarget("experiences", "fpt-japan", base())).toEqual({
      page: "home",
      anchor: "exp-fpt-japan",
    });
  });

  it("a school points at its tree parent", () => {
    expect(publicTarget("education", "fpt-university", base())).toEqual({
      page: "home",
      anchor: "exp-fpt-university",
    });
  });

  it("a project the tree shows points at its child card, even when it is starred", () => {
    expect(publicTarget("projects", "skg-coa", base())).toEqual({
      page: "home",
      anchor: "tree-skg-coa",
    });
    expect(publicTarget("projects", "siteplus", base())).toEqual({
      page: "home",
      anchor: "tree-siteplus",
    });
  });

  it("a project outside the tree with a home card points at that card", () => {
    const c = base();
    c.projects.push(
      personal({ id: "side-star", featured: true, featuredOrder: 0 }),
    );
    expect(publicTarget("projects", "side-star", c)).toEqual({
      page: "home",
      anchor: "proj-side-star",
    });
  });

  it("any other project points at its row on the all-projects page", () => {
    const c = base();
    c.projects.push(personal({ id: "side-project" }));
    expect(publicTarget("projects", "side-project", c)).toEqual({
      page: "projects",
      anchor: "row-side-project",
    });
    // Without the content (a new item) a project still has its archive row.
    expect(publicTarget("projects", "side-project")).toEqual({
      page: "projects",
      anchor: "row-side-project",
    });
  });

  it("a hidden stint or school, or no content, falls back to the Experience section", () => {
    const c = base();
    c.experiences = c.experiences.map((e) =>
      e.id === "fpt-japan" ? { ...e, published: false } : e,
    );
    expect(publicTarget("experiences", "fpt-japan", c)).toEqual({
      page: "home",
      anchor: "experience",
    });
    expect(publicTarget("education", "gone", c)).toEqual({
      page: "home",
      anchor: "experience",
    });
    expect(publicTarget("experiences", "skg-coa")).toEqual({
      page: "home",
      anchor: "experience",
    });
  });

  it("the other lists point at their section", () => {
    expect(publicTarget("certificates", "jlpt")).toEqual({
      page: "home",
      anchor: "certificates",
    });
    expect(publicTarget("activities", "x").anchor).toBe("certificates");
    expect(publicTarget("skills", "react").anchor).toBe("skills");
    expect(publicTarget("why_cards", "x").anchor).toBe("why");
  });
});

describe("publicPath / publicUrl", () => {
  it("builds the path on the home page or the archive", () => {
    expect(publicPath({ page: "home", anchor: "tree-siteplus" })).toBe(
      "/en#tree-siteplus",
    );
    expect(publicPath({ page: "projects", anchor: "row-side" }, "ja")).toBe(
      "/ja/projects#row-side",
    );
  });

  it("builds the link on the site this admin runs on", () => {
    expect(
      publicUrl(
        { page: "home", anchor: "tree-siteplus" },
        "https://preview.vercel.app",
      ),
    ).toBe("https://preview.vercel.app/en#tree-siteplus");
  });
});
