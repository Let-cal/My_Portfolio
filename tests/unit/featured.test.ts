import { describe, expect, it } from "vitest";
import { contentSchema, type Project } from "@/content/schema";
import seed from "@/content/seed.json";
import { featuredProjects, starRefusal } from "@/lib/featured";

const projects = (): Project[] =>
  contentSchema.parse(structuredClone(seed)).projects;
const byId = (list: Project[], id: string) => list.find((p) => p.id === id)!;
const unstarAll = (list: Project[]) =>
  list.forEach((p) => {
    p.featured = false;
    p.featuredOrder = null;
  });

describe("featuredProjects", () => {
  it("returns the starred seed projects in featuredOrder", () => {
    expect(featuredProjects(projects()).map((p) => p.id)).toEqual([
      "siteplus",
      "zodiacgems",
      "meet-my-lecturer",
    ]);
  });

  it("featured uses featuredOrder then fills with newest", () => {
    const list = projects();
    unstarAll(list);
    const meet = byId(list, "meet-my-lecturer");
    meet.featured = true;
    meet.featuredOrder = 1;
    const out = featuredProjects(list).map((p) => p.id);
    // starred first, then the newest published by start (2026-04, 2026-03)
    expect(out).toEqual([
      "meet-my-lecturer",
      "skg-ai-agent",
      "skg-flexybox-p2",
    ]);
  });

  it("falls back to the newest three when nothing is starred", () => {
    const list = projects();
    unstarAll(list);
    expect(featuredProjects(list).map((p) => p.id)).toEqual([
      "skg-ai-agent",
      "skg-flexybox-p2",
      "skg-coa",
    ]);
  });

  it("fill skips unpublished projects", () => {
    const list = projects();
    unstarAll(list);
    byId(list, "skg-ai-agent").published = false;
    expect(featuredProjects(list).map((p) => p.id)).toEqual([
      "skg-flexybox-p2",
      "skg-coa",
      "skg-flexybox-p1",
    ]);
  });

  it("an unpublished star is not shown", () => {
    const list = projects();
    byId(list, "zodiacgems").published = false;
    expect(featuredProjects(list).map((p) => p.id)).toEqual([
      "siteplus",
      "meet-my-lecturer",
      "skg-ai-agent",
    ]);
  });

  it("more than 3 starred → first 3 by order", () => {
    const list = projects();
    const extra = byId(list, "skg-coa");
    extra.featured = true;
    extra.featuredOrder = 0;
    byId(list, "skg-ai-agent").featured = true;
    byId(list, "skg-ai-agent").featuredOrder = 4;
    expect(featuredProjects(list).map((p) => p.id)).toEqual([
      "skg-coa",
      "siteplus",
      "zodiacgems",
    ]);
  });

  it("a star without an order comes after ordered ones", () => {
    const list = projects();
    unstarAll(list);
    const a = byId(list, "skg-coa");
    a.featured = true;
    a.featuredOrder = null;
    const b = byId(list, "siteplus");
    b.featured = true;
    b.featuredOrder = 2;
    expect(featuredProjects(list, 2).map((p) => p.id)).toEqual([
      "siteplus",
      "skg-coa",
    ]);
  });

  it("honours a smaller limit and does not mutate its input", () => {
    const list = projects();
    const before = list.map((p) => p.id);
    expect(featuredProjects(list, 1)).toHaveLength(1);
    expect(list.map((p) => p.id)).toEqual(before);
  });

  it("returns what exists when fewer projects than the limit", () => {
    expect(featuredProjects(projects().slice(0, 1))).toHaveLength(1);
    expect(featuredProjects([])).toEqual([]);
  });
});

describe("starRefusal", () => {
  const MESSAGE = "Đã có 3 dự án nổi bật. Bỏ sao một dự án khác trước.";

  it("starRefusal blocks the 4th", () => {
    expect(starRefusal(projects(), "skg-coa")).toBe(MESSAGE);
  });

  it("allows starring while fewer than 3 are starred", () => {
    const list = projects();
    byId(list, "meet-my-lecturer").featured = false;
    expect(starRefusal(list, "skg-coa")).toBeNull();
  });

  it("never blocks removing a star or re-saving a starred project", () => {
    expect(starRefusal(projects(), "siteplus")).toBeNull();
  });

  it("also blocks when data already holds more than 3 stars", () => {
    const list = projects();
    byId(list, "skg-ai-agent").featured = true;
    expect(starRefusal(list, "skg-coa")).toBe(MESSAGE);
  });
});
