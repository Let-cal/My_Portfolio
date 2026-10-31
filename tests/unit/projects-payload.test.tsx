import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import seed from "@/content/seed.json";
import { contentSchema } from "@/content/schema";
import type { ProjectsBento } from "@/components/sections/projects/ProjectsBento";
import { stubIntersectionObserver } from "../helpers/io-stub";

type BentoProps = ComponentProps<typeof ProjectsBento>;
const bento = vi.hoisted(() => ({ props: null as BentoProps | null }));
vi.mock("@/components/sections/projects/ProjectsBento", () => ({
  ProjectsBento: (props: BentoProps) => {
    bento.props = props;
    return null;
  },
}));

import { Projects } from "@/components/sections/Projects";

const content = contentSchema.parse(seed);

beforeEach(() => stubIntersectionObserver());
afterEach(() => vi.unstubAllGlobals());

describe("Projects section payload", () => {
  it("sends each case study once: in the panel items, with only a flag on the cards", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Projects content={content} locale="en" />
      </NextIntlClientProvider>,
    );
    const { projects, caseItems } = bento.props!;
    expect(caseItems.length).toBeGreaterThan(0);
    const cards = JSON.stringify(projects);
    for (const item of caseItems) {
      expect(cards).not.toContain(item.caseStudy.problem);
      expect(projects.find((p) => p.id === item.id)?.hasCaseStudy).toBe(true);
    }
    for (const p of projects)
      expect(p.hasCaseStudy).toBe(caseItems.some((i) => i.id === p.id));
  });
});
