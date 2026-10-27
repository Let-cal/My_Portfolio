import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema, type Content, type Locale } from "@/content/schema";
import type { SkillMapData } from "@/components/sections/skills/SkillMap";
import seed from "@/content/seed.json";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import viMessages from "@/messages/vi.json";
import { stubIntersectionObserver } from "../helpers/io-stub";

const captured = vi.hoisted(() => ({ data: [] as SkillMapData[] }));
vi.mock("@/components/sections/skills/SkillMap", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/sections/skills/SkillMap")
    >();
  return {
    ...actual,
    SkillMap(props: { data: SkillMapData }) {
      captured.data.push(props.data);
      return <actual.SkillMap {...props} />;
    },
  };
});

import { Skills } from "@/components/sections/Skills";

const base = contentSchema.parse(seed);
const messages = { en, ja, vi: viMessages };

const personal = (id: string, start: string, featured = false) => ({
  ...base.projects[0],
  id,
  title: id,
  kind: "personal" as const,
  experienceId: null,
  educationId: null,
  featured,
  featuredOrder: featured ? 1 : null,
  published: true,
  start,
  end: null,
});

/** Five personal projects: `starred` is starred, `newest` and `newer` fill the other two bento slots, `oldest` gets no bento card. */
function fixture(): Content {
  const projects = [
    personal("starred", "2020-01", true),
    personal("newest", "2026-05"),
    personal("newer", "2026-04"),
    personal("older", "2025-01"),
    personal("oldest", "2024-01"),
  ];
  return {
    ...base,
    projects,
    skills: [
      {
        ...base.skills[0],
        id: "typescript",
        name: "TypeScript",
        group: "languages",
        experienceIds: [],
        projectIds: projects.map((p) => p.id),
      },
    ],
  };
}

function anchors(content: Content, locale: Locale) {
  captured.data = [];
  render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <Skills content={content} locale={locale} />
    </NextIntlClientProvider>,
  );
  return Object.fromEntries(
    captured.data.at(-1)!.skills[0].evidence.map((e) => [e.id, e.anchor]),
  );
}

beforeEach(() => {
  stubIntersectionObserver();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("skill evidence links for projects", () => {
  it("starred and bento-filled projects keep #proj-<id>; others link to the /projects row", () => {
    expect(anchors(fixture(), "en")).toEqual({
      starred: "proj-starred",
      newest: "proj-newest",
      newer: "proj-newer",
      older: "/en/projects#row-older",
      oldest: "/en/projects#row-oldest",
    });
  });

  it("uses the locale of the page in the /projects link", () => {
    expect(anchors(fixture(), "ja").oldest).toBe("/ja/projects#row-oldest");
    expect(anchors(fixture(), "vi").oldest).toBe("/vi/projects#row-oldest");
  });

  it("tree projects keep #tree-<id>, even when not starred", () => {
    const content: Content = {
      ...base,
      skills: [
        {
          ...base.skills[0],
          id: "typescript",
          name: "TypeScript",
          group: "languages",
          experienceIds: [],
          projectIds: ["siteplus", "skg-coa"],
        },
      ],
    };
    expect(anchors(content, "en")).toEqual({
      siteplus: "tree-siteplus",
      "skg-coa": "tree-skg-coa",
    });
  });
});
