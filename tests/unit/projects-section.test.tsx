import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Projects } from "@/components/sections/Projects";
import { contentSchema, type Content, type Locale } from "@/content/schema";
import seed from "@/content/seed.json";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi_ from "@/messages/vi.json";
import { stubIntersectionObserver } from "../helpers/io-stub";

const base: Content = contentSchema.parse(seed);
const messages = { en, ja, vi: vi_ };

function renderProjects(content: Content = base, locale: Locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <Projects content={content} locale={locale} />
    </NextIntlClientProvider>,
  );
}

const cardIds = () =>
  Array.from(document.querySelectorAll("[id^='proj-']")).map((n) => n.id);

const patch = (id: string, change: Partial<Content["projects"][number]>) => ({
  ...base,
  projects: base.projects.map((p) => (p.id === id ? { ...p, ...change } : p)),
});

beforeEach(() => stubIntersectionObserver());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Projects section on the home page", () => {
  it("bento shows featuredProjects in order", () => {
    renderProjects();
    expect(cardIds()).toEqual([
      "proj-siteplus",
      "proj-zodiacgems",
      "proj-meet-my-lecturer",
    ]);
  });

  it("follows featuredOrder, not sortIndex", () => {
    const content: Content = {
      ...base,
      projects: base.projects.map((p) =>
        p.id === "meet-my-lecturer"
          ? { ...p, featuredOrder: 1 }
          : p.id === "siteplus"
            ? { ...p, featuredOrder: 3 }
            : p,
      ),
    };
    renderProjects(content);
    expect(cardIds()).toEqual([
      "proj-meet-my-lecturer",
      "proj-zodiacgems",
      "proj-siteplus",
    ]);
  });

  it("shows only three cards even when more are starred in the data", () => {
    const content: Content = {
      ...base,
      projects: base.projects.map((p) =>
        p.id === "skg-ai-agent"
          ? { ...p, featured: true, featuredOrder: 4 }
          : p,
      ),
    };
    renderProjects(content);
    expect(cardIds()).toEqual([
      "proj-siteplus",
      "proj-zodiacgems",
      "proj-meet-my-lecturer",
    ]);
  });

  it("fills from the newest published projects when fewer than three are starred", () => {
    const content: Content = {
      ...base,
      projects: base.projects.map((p) =>
        p.id === "zodiacgems" || p.id === "meet-my-lecturer"
          ? { ...p, featured: false, featuredOrder: null }
          : p,
      ),
    };
    renderProjects(content);
    expect(cardIds()).toEqual([
      "proj-siteplus",
      "proj-skg-ai-agent",
      "proj-skg-flexybox-p2",
    ]);
  });

  it("does not render a card for a project that is not featured", () => {
    renderProjects();
    expect(document.getElementById("proj-skg-coa")).toBeNull();
    expect(document.getElementById("proj-tongue-ai-driver-ms")).toBeNull();
  });

  it("cards keep #proj-<id>", () => {
    renderProjects();
    for (const id of ["siteplus", "zodiacgems", "meet-my-lecturer"])
      expect(document.getElementById(`proj-${id}`)).not.toBeNull();
  });

  it("View all link points to /<locale>/projects with the total count", () => {
    renderProjects();
    const link = screen.getByRole("link", { name: /view all 8 projects/i });
    expect(link).toHaveAttribute("href", "/en/projects");
    expect(
      within(document.getElementById("projects")!).getByRole("link", {
        name: /view all/i,
      }),
    ).toBe(link);
  });

  it("counts published projects only", () => {
    renderProjects(patch("skg-coa", { published: false }));
    expect(
      screen.getByRole("link", { name: /view all 7 projects/i }),
    ).toBeInTheDocument();
  });

  it("uses the singular for one project", () => {
    renderProjects({
      ...base,
      projects: base.projects.map((p, i) => ({ ...p, published: i === 0 })),
    });
    expect(
      screen.getByRole("link", { name: /^view all 1 project$/i }),
    ).toBeInTheDocument();
  });

  it.each([
    ["ja" as const, "/ja/projects", "8件のプロジェクトをすべて見る"],
    ["vi" as const, "/vi/projects", "Xem tất cả 8 dự án"],
  ])("localizes the link for %s", (locale, href, text) => {
    renderProjects(base, locale);
    const link = screen.getByRole("link", { name: text });
    expect(link).toHaveAttribute("href", href);
  });
});
