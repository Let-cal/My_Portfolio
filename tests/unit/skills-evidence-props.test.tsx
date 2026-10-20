import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, formatPeriod: vi.fn(actual.formatPeriod) };
});

import { Skills } from "@/components/sections/Skills";
import { formatPeriod } from "@/lib/format";

const base = contentSchema.parse(seed);
const messages = { en, ja, vi: viMessages };

function fixture(): Content {
  return {
    ...base,
    experiences: [
      {
        ...base.experiences[0],
        id: "shared",
        company: "Example Company",
        published: true,
        position: { en: "Engineer", ja: "エンジニア", vi: "Kỹ sư" },
        start: "2026-04",
        end: "2026-09",
      },
      { ...base.experiences[0], id: "private", published: false },
    ],
    projects: [
      {
        ...base.projects[0],
        id: "shared",
        title: "Example Project",
        published: true,
        role: { en: "Lead", ja: "リード", vi: "Trưởng nhóm" },
        start: "2025-01",
        end: null,
      },
      { ...base.projects[0], id: "private", published: false },
    ],
    skills: [
      {
        ...base.skills[0],
        id: "typescript",
        name: "TypeScript",
        group: "languages",
        experienceIds: ["shared", "private", "missing"],
        projectIds: ["shared", "private", "missing"],
      },
      {
        ...base.skills[1],
        id: "react",
        name: "React",
        group: "frameworks",
        experienceIds: ["shared", "private", "missing"],
        projectIds: ["shared", "private", "missing"],
      },
    ],
  };
}

function section(content: Content, locale: Locale) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <Skills content={content} locale={locale} />
    </NextIntlClientProvider>
  );
}

const props = () => captured.data.at(-1)!;

beforeEach(() => {
  captured.data = [];
  vi.mocked(formatPeriod).mockClear();
  stubIntersectionObserver();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([
  {
    locale: "en" as const,
    role: "Engineer",
    period: "Apr 2026 – Sep 2026",
    projectRole: "Lead",
    projectPeriod: "Jan 2025 – Present",
  },
  {
    locale: "ja" as const,
    role: "エンジニア",
    period: "2026年4月 – 2026年9月",
    projectRole: "リード",
    projectPeriod: "2025年1月 – 現在",
  },
  {
    locale: "vi" as const,
    role: "Kỹ sư",
    period: "Th4 2026 – Th9 2026",
    projectRole: "Trưởng nhóm",
    projectPeriod: "Th1 2025 – Hiện tại",
  },
])(
  "reuses evidence across groups while preserving $locale text, ordering, and published filtering",
  ({ locale, role, period, projectRole, projectPeriod }) => {
    render(section(fixture(), locale));
    const [first, second] = props().skills;
    const expected = [
      {
        kind: "exp",
        id: "shared",
        anchor: "exp-shared",
        title: "Example Company",
        role,
        period,
      },
      {
        kind: "proj",
        id: "shared",
        anchor: "proj-shared",
        title: "Example Project",
        role: projectRole,
        period: projectPeriod,
      },
    ];
    expect(first.group).not.toBe(second.group);
    expect(first.evidence).toEqual(expected);
    expect(second.evidence).toEqual(expected);
    expect(first.evidence[0]).toBe(second.evidence[0]);
    expect(first.evidence[1]).toBe(second.evidence[1]);
    expect(first.evidence[0]).not.toBe(first.evidence[1]);
    // The capture wraps the real SkillMap rather than replacing the rendered UI.
    expect(document.querySelectorAll("[data-skill-chip]")).toHaveLength(2);
  },
);

it("formats each unique evidence anchor once instead of once per linked skill", () => {
  render(section(fixture(), "en"));
  expect(formatPeriod).toHaveBeenCalledTimes(2);
  expect(formatPeriod).toHaveBeenNthCalledWith(1, "2026-04", "2026-09", "en");
  expect(formatPeriod).toHaveBeenNthCalledWith(2, "2025-01", null, "en");
});

it("keeps the evidence cache local to a render so changed content and locale cannot reuse stale text", () => {
  const content = fixture();
  const { rerender } = render(section(content, "en"));
  const previous = props().skills[0].evidence[0];
  const updated: Content = {
    ...content,
    experiences: content.experiences.map((experience) =>
      experience.id === "shared"
        ? {
            ...experience,
            company: "Changed Company",
            start: "2026-05",
            end: "2026-05",
          }
        : experience,
    ),
  };
  rerender(section(updated, "vi"));
  const [first, second] = props().skills;
  expect(first.evidence[0]).not.toBe(previous);
  expect(first.evidence[0]).toBe(second.evidence[0]);
  expect(first.evidence[0]).toEqual({
    kind: "exp",
    id: "shared",
    anchor: "exp-shared",
    title: "Changed Company",
    role: "Kỹ sư",
    period: "Th5 2026",
  });
  expect(first.evidence[1].period).toBe("Th1 2025 – Hiện tại");
  expect(formatPeriod).toHaveBeenCalledTimes(4);
});
