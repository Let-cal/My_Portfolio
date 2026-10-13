import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import seed from "@/content/seed.json";
import { contentSchema, type Content, type Locale } from "@/content/schema";

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/en",
}));

import { Experience } from "@/components/sections/Experience";
import { RoleProvider } from "@/components/site/RoleProvider";
import { RoleSwitcher } from "@/components/site/RoleSwitcher";

const base: Content = contentSchema.parse(seed);

function renderExperience(opts: { role?: string; locale?: Locale; content?: Content; withSwitcher?: boolean } = {}) {
  search.value = opts.role ? `role=${opts.role}` : "";
  const locale = opts.locale ?? "en";
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : en}>
      <RoleProvider>
        {opts.withSwitcher && <RoleSwitcher />}
        <Experience content={opts.content ?? base} locale={locale} />
      </RoleProvider>
    </NextIntlClientProvider>,
  );
}

const el = (id: string) => {
  const node = document.getElementById(`exp-${id}`);
  if (!node) throw new Error(`#exp-${id} not found`);
  return node;
};
const before = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("Experience river", () => {
  beforeEach(() => {
    replace.mockClear();
    window.history.replaceState(null, "", "/en");
  });

  it("is a section labelled by its heading", () => {
    renderExperience();
    const section = document.getElementById("experience");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByRole("heading", { level: 2, name: "Experience" })).toBeInTheDocument();
  });

  it("gives every published experience an #exp-<id> element and skips unpublished ones", () => {
    const content: Content = {
      ...base,
      experiences: base.experiences.map((e) => (e.id === "fpt-japan" ? { ...e, published: false } : e)),
    };
    renderExperience({ content });
    for (const e of base.experiences.filter((x) => x.id !== "fpt-japan")) expect(el(e.id)).toBeInTheDocument();
    expect(document.getElementById("exp-fpt-japan")).toBeNull();
  });

  it("orders by the default role: FlexyBox Phase 1 before AI Agent", () => {
    renderExperience();
    expect(before(el("skg-flexybox-p1"), el("skg-ai-agent"))).toBe(true);
  });

  it("orders by role pm: AI Agent before FlexyBox Phase 1", async () => {
    renderExperience({ role: "pm" });
    await waitFor(() => expect(before(el("skg-ai-agent"), el("skg-flexybox-p1"))).toBe(true));
  });

  it("reorders when the role is switched on the page", async () => {
    renderExperience({ withSwitcher: true });
    expect(before(el("skg-flexybox-p1"), el("skg-ai-agent"))).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: "Project Manager" }));
    expect(before(el("skg-ai-agent"), el("skg-flexybox-p1"))).toBe(true);
  });

  it("shows periods as 'Apr 2026 – Sep 2026' in EN", () => {
    renderExperience();
    expect(within(el("skg-ai-agent")).getByText("Apr 2026 – Sep 2026")).toBeInTheDocument();
  });

  it("shows periods as '2026年4月 – 2026年9月' in JA", () => {
    renderExperience({ locale: "ja" });
    expect(within(el("skg-ai-agent")).getByText("2026年4月 – 2026年9月")).toBeInTheDocument();
  });

  it("prints 'Present' for a non-SKG experience that has no end date", () => {
    const content: Content = {
      ...base,
      experiences: base.experiences.map((e) => (e.id === "fpt-japan" ? { ...e, start: "2024-01", end: null } : e)),
    };
    renderExperience({ content });
    expect(within(el("fpt-japan")).getByText("Jan 2024 – Present")).toBeInTheDocument();
  });

  it("groups the SKG experiences under one company header with its two position lines", () => {
    renderExperience({ role: "pm" });
    const header = screen.getByRole("heading", { level: 3, name: "SKG Software (Splus) · Aug 2025 – Sep 2026" });
    const group = header.closest("li") as HTMLElement;
    expect(group).not.toBeNull();
    const lines = within(header.nextElementSibling as HTMLElement);
    expect(lines.getByText("Software Engineer Intern")).toBeInTheDocument();
    expect(lines.getByText("Aug 2025 – Oct 2025")).toBeInTheDocument();
    expect(lines.getByText("Software Engineer — acting Project Manager / Tech Lead")).toBeInTheDocument();
    expect(lines.getByText("Oct 2025 – Sep 2026")).toBeInTheDocument();
    for (const id of ["skg-ai-agent", "skg-flexybox-p2", "skg-coa", "skg-flexybox-p1", "skg-intern"]) {
      expect(group).toContainElement(el(id));
    }
    expect(group).not.toContainElement(el("fpt-japan"));
    expect(screen.queryByText(/Present/)).not.toBeInTheDocument();
  });

  it("puts FPT Japan after the SKG group and Education last", () => {
    renderExperience();
    const edu = screen.getByRole("heading", { level: 3, name: /FPT University/ }).closest("li") as HTMLElement;
    expect(within(edu).getByText("Education")).toBeInTheDocument();
    expect(within(edu).getByText("Bachelor of Information Technology")).toBeInTheDocument();
    expect(before(el("fpt-japan"), edu)).toBe(true);
    expect(before(el("skg-intern"), el("fpt-japan"))).toBe(true);
    expect(edu.nextElementSibling).toBeNull();
  });

  it("dims the other items on hover and restores them on leave", async () => {
    renderExperience();
    const hovered = el("skg-coa");
    await userEvent.hover(hovered);
    expect(hovered).not.toHaveClass("opacity-50");
    expect(el("skg-ai-agent")).toHaveClass("opacity-50");
    expect(el("fpt-japan")).toHaveClass("opacity-50");
    await userEvent.unhover(hovered);
    expect(el("skg-ai-agent")).not.toHaveClass("opacity-50");
  });

  it("draws the river as a decorative svg behind the list", () => {
    const { container } = renderExperience();
    const svg = container.querySelector("svg[data-river]");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.querySelector("path")).not.toBeNull();
  });

  it("wraps each experience card in a glow card", () => {
    renderExperience();
    const glow = el("skg-coa").querySelector("[data-glow-card]");
    expect(glow).not.toBeNull();
    expect(glow).toHaveTextContent("Team size: 4");
  });

  it("traces the river with a scroll beam around the list", () => {
    const { container } = renderExperience();
    const beam = container.querySelector("[data-tracing-beam]");
    expect(beam).not.toBeNull();
    expect(beam?.querySelector("svg[data-river]")).not.toBeNull();
    expect(beam?.querySelector("#exp-skg-coa")).not.toBeNull();
  });

  it("renders tech chips and team size", () => {
    renderExperience();
    const item = within(el("skg-coa"));
    expect(item.getByText("Team size: 4")).toBeInTheDocument();
    expect(item.getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});

describe("Case study sheet", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/en");
  });

  it("opens from the item, shows the four headings and the text, and Esc closes it", async () => {
    renderExperience({ role: "pm" });
    const trigger = within(el("skg-ai-agent")).getByRole("button", { name: /AI Agent/ });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Software Engineer, acting Project Manager/)).toBeInTheDocument();
    for (const name of ["Problem", "Role", "Decisions", "Result"]) {
      expect(within(dialog).getByRole("heading", { name })).toBeInTheDocument();
    }
    const cs = base.experiences.find((e) => e.id === "skg-ai-agent")!.caseStudy!;
    expect(within(dialog).getByText(cs.problem.en)).toBeInTheDocument();
    expect(within(dialog).getByText(cs.result.en)).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("localizes the four headings and the body in JA", async () => {
    renderExperience({ locale: "ja", role: "pm" });
    await userEvent.click(within(el("skg-ai-agent")).getByRole("button"));
    const dialog = await screen.findByRole("dialog");
    for (const name of [ja.caseStudy.problem, ja.caseStudy.role, ja.caseStudy.decisions, ja.caseStudy.result]) {
      expect(within(dialog).getByRole("heading", { name })).toBeInTheDocument();
    }
    const cs = base.experiences.find((e) => e.id === "skg-ai-agent")!.caseStudy!;
    expect(within(dialog).getByText(cs.problem.ja!)).toBeInTheDocument();
  });

  it("does not make items without a case study clickable", () => {
    renderExperience();
    expect(within(el("fpt-japan")).queryByRole("button")).toBeNull();
  });
});
