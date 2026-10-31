import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import seed from "@/content/seed.json";
import { contentSchema, type Content, type Locale } from "@/content/schema";
import { stubIntersectionObserver } from "../helpers/io-stub";

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/en",
}));

import { Experience } from "@/components/sections/Experience";
import { RoleProvider } from "@/components/site/RoleProvider";
import { RoleSwitcher } from "@/components/site/RoleSwitcher";

const base: Content = contentSchema.parse(seed);

function renderExperience(
  opts: {
    role?: string;
    locale?: Locale;
    content?: Content;
    withSwitcher?: boolean;
  } = {},
) {
  search.value = opts.role ? `role=${opts.role}` : "";
  const locale = opts.locale ?? "en";
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "ja" ? ja : en}
    >
      <RoleProvider>
        {opts.withSwitcher && <RoleSwitcher />}
        <Experience content={opts.content ?? base} locale={locale} />
      </RoleProvider>
    </NextIntlClientProvider>,
  );
}

const byId = (id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} not found`);
  return node;
};
/** The disclosure button of a parent (`exp-<slug>`). */
const toggle = (anchor: string) =>
  byId(anchor).querySelector<HTMLButtonElement>("button[aria-expanded]")!;
const panelOf = (anchor: string) =>
  byId(toggle(anchor).getAttribute("aria-controls")!);
const isOpen = (anchor: string) =>
  toggle(anchor).getAttribute("aria-expanded") === "true";
const childIds = () =>
  [...document.querySelectorAll<HTMLElement>("[id^='tree-']")].map((n) => n.id);

beforeEach(() => {
  stubIntersectionObserver();
  replace.mockClear();
  window.history.replaceState(null, "", "/en");
});
afterEach(() => vi.unstubAllGlobals());

describe("Experience journey tree", () => {
  it("is a section labelled by its heading", () => {
    renderExperience();
    expect(
      within(byId("experience")).getByRole("heading", {
        level: 2,
        name: "Experience",
      }),
    ).toBeInTheDocument();
  });

  it("lists the parents newest first: SKG, FPT University, FPT Japan", () => {
    renderExperience();
    const parents = [
      ...document.querySelectorAll<HTMLElement>("[data-journey-parent]"),
    ].map((n) => n.id);
    expect(parents).toEqual([
      "exp-skg-software",
      "exp-fpt-university",
      "exp-fpt-japan",
    ]);
  });

  it("newest parent expanded, others collapsed with chip", () => {
    renderExperience();
    expect(isOpen("exp-skg-software")).toBe(true);
    expect(panelOf("exp-skg-software")).not.toHaveAttribute("inert");
    for (const anchor of ["exp-fpt-university", "exp-fpt-japan"]) {
      expect(isOpen(anchor)).toBe(false);
      expect(panelOf(anchor)).toHaveAttribute("inert");
    }
    expect(within(toggle("exp-fpt-university")).getByText("3 projects"));
    expect(within(toggle("exp-fpt-japan")).getByText("internship"));
    expect(within(toggle("exp-skg-software")).getByText("5 projects"));
  });

  it("Enter and Space toggle a parent, and focus stays on the button", async () => {
    const user = userEvent.setup();
    renderExperience();
    const button = toggle("exp-fpt-university");
    button.focus();
    await user.keyboard("{Enter}");
    expect(isOpen("exp-fpt-university")).toBe(true);
    expect(panelOf("exp-fpt-university")).not.toHaveAttribute("inert");
    expect(button).toHaveFocus();
    await user.keyboard(" ");
    expect(isOpen("exp-fpt-university")).toBe(false);
    expect(button).toHaveFocus();
    await user.click(toggle("exp-skg-software"));
    expect(isOpen("exp-skg-software")).toBe(false);
  });

  it("ties every disclosure button to its panel", () => {
    renderExperience();
    for (const n of document.querySelectorAll("[data-journey-parent]")) {
      const button = toggle(n.id);
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
      expect(n).toContainElement(panelOf(n.id));
    }
  });

  it("shows period, duration, location and the summary chips in the parent header", () => {
    renderExperience();
    const skg = toggle("exp-skg-software");
    expect(skg).toHaveTextContent("Aug 2025 – Sep 2026");
    expect(skg).toHaveTextContent("1 yr 2 mos");
    expect(within(skg).getByText("5 projects")).toBeInTheDocument();
    expect(within(skg).getByText("2 positions")).toBeInTheDocument();
    expect(
      within(skg).getByText("Intern → Software Engineer"),
    ).toBeInTheDocument();
    const school = toggle("exp-fpt-university");
    expect(school).toHaveTextContent("Education");
    expect(within(school).getByText("GPA 7.66/10")).toBeInTheDocument();
    expect(within(toggle("exp-fpt-japan")).queryByText(/positions/)).toBeNull();
  });

  it("renders stints with their projects under them", () => {
    renderExperience();
    const sections = [
      ...panelOf("exp-skg-software").querySelectorAll<HTMLElement>(
        "section[aria-labelledby]",
      ),
    ];
    expect(sections).toHaveLength(2);
    const [engineer, intern] = sections;
    const heading = (section: HTMLElement) =>
      byId(section.getAttribute("aria-labelledby")!);
    expect(heading(engineer).tagName).toBe("H4");
    expect(heading(engineer)).toHaveTextContent(
      "Software Engineer — acting Project Manager / Tech Lead",
    );
    expect(heading(engineer)).toHaveTextContent("Oct 2025 – Sep 2026");
    expect(heading(engineer)).toHaveTextContent("1 yr");
    expect(heading(intern)).toHaveTextContent("Software Engineer Intern");
    expect(heading(intern)).toHaveTextContent("Aug 2025 – Oct 2025");
    expect(heading(intern)).toHaveTextContent("3 mos");
    const ids = (section: HTMLElement) =>
      [...section.querySelectorAll("[data-journey-child]")].map((n) => n.id);
    expect(ids(engineer)).toEqual([
      "tree-skg-ai-agent",
      "tree-skg-flexybox-p2",
      "tree-skg-coa",
    ]);
    expect(ids(intern)).toEqual([
      "tree-skg-flexybox-p1",
      "tree-tongue-ai-driver-ms",
    ]);
  });

  it("shows the promotion connector between intern and engineer", () => {
    renderExperience();
    const marker = within(panelOf("exp-skg-software")).getByText(
      "Promoted to full-time · Oct 2025",
    );
    const [engineer, intern] = panelOf("exp-skg-software").querySelectorAll(
      "section[aria-labelledby]",
    );
    expect(
      engineer.compareDocumentPosition(marker) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      intern.compareDocumentPosition(marker) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });

  it("description disclosure keeps text in the DOM", async () => {
    const user = userEvent.setup();
    renderExperience();
    const card = byId("tree-skg-coa");
    const coa = base.projects.find((p) => p.id === "skg-coa")!;
    const button = within(card).getByRole("button", {
      name: "Show description",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    const region = byId(button.getAttribute("aria-controls")!);
    expect(region).toHaveTextContent(coa.summary.en);
    expect(region).toHaveAttribute("inert");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveTextContent("Hide description");
    expect(region).not.toHaveAttribute("inert");
    expect(region).toHaveTextContent(coa.summary.en);
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(region).toHaveAttribute("inert");
  });

  it("shows the result line in full and the duration on each row", () => {
    renderExperience();
    const coa = base.projects.find((p) => p.id === "skg-coa")!;
    const card = byId("tree-skg-coa");
    expect(card).toHaveTextContent(coa.caseStudy!.result.en);
    expect(card).toHaveTextContent("Oct 2025 – Mar 2026");
    expect(card).toHaveTextContent("6 mos");
  });

  it("timeline has an accessible label and one bar per project", async () => {
    renderExperience();
    const skg = panelOf("exp-skg-software");
    const timeline = await within(skg).findByRole("img");
    const label = timeline.getAttribute("aria-label")!;
    for (const text of [
      "SKG Software (Splus)",
      "Intern",
      "Software Engineer",
      "AI Agent",
      "COA",
      "Aug 2025 – Oct 2025",
    ])
      expect(label).toContain(text);
    const bars = [...timeline.querySelectorAll("[data-bar]")].map((n) =>
      n.getAttribute("data-sync"),
    );
    expect(bars).toEqual([
      "skg-ai-agent",
      "skg-flexybox-p2",
      "skg-coa",
      "skg-flexybox-p1",
      "tongue-ai-driver-ms",
    ]);
  });

  it("keeps the header of a stint with no projects but renders no empty list under it", () => {
    const content: Content = {
      ...base,
      projects: base.projects.filter((p) => p.experienceId !== "skg-intern"),
    };
    renderExperience({ content });
    const skg = panelOf("exp-skg-software");
    const stints = [...skg.querySelectorAll("section.jt-stint")];
    const intern = stints.find((s) => /Intern/.test(s.textContent ?? ""))!;
    expect(intern.querySelector("h4")).toBeInTheDocument();
    expect(intern.querySelector("ol")).toBeNull();
    const engineer = stints.find((s) => s !== intern)!;
    expect(engineer.querySelector("ol")).toBeInTheDocument();
    expect(document.querySelectorAll("ol:empty")).toHaveLength(0);
  });

  it("FPT Japan has no timeline and no stint headings", () => {
    renderExperience();
    const japan = byId("exp-fpt-japan");
    expect(within(japan).queryByRole("img")).toBeNull();
    expect(japan.querySelector("section, h4")).toBeNull();
    expect(byId("exp-fpt-university").querySelector("[role='img']")).toBeNull();
  });

  it("hovering a row lights its bar", async () => {
    renderExperience();
    const skg = panelOf("exp-skg-software");
    await within(skg).findByRole("img");
    const bar = (id: string) =>
      skg.querySelector<HTMLElement>(`[data-bar][data-sync="${id}"]`)!;
    fireEvent.mouseOver(within(byId("tree-skg-coa")).getByText("C#"));
    expect(bar("skg-coa")).toHaveAttribute("data-lit");
    expect(byId("tree-skg-coa")).toHaveAttribute("data-lit");
    expect(bar("skg-ai-agent")).not.toHaveAttribute("data-lit");
    fireEvent.mouseOver(bar("skg-ai-agent"));
    expect(byId("tree-skg-ai-agent")).toHaveAttribute("data-lit");
    expect(bar("skg-coa")).not.toHaveAttribute("data-lit");
    fireEvent.mouseLeave(skg.closest("[data-journey-tree]")!);
    expect(skg.querySelector("[data-lit]")).toBeNull();
    within(byId("tree-skg-flexybox-p1"))
      .getByRole("button", { name: /Show description/ })
      .focus();
    expect(bar("skg-flexybox-p1")).toHaveAttribute("data-lit");
  });

  it("clicking a bar scrolls its row into view", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderExperience();
    const skg = panelOf("exp-skg-software");
    await within(skg).findByRole("img");
    fireEvent.click(
      skg.querySelector<HTMLElement>('[data-bar][data-sync="skg-coa"]')!,
    );
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts.at(-1)).toBe(byId("tree-skg-coa"));
  });

  it("stamps a kanji-year hanko on every parent, filled when open", async () => {
    const user = userEvent.setup();
    renderExperience();
    const hanko = (anchor: string) =>
      byId(anchor).querySelector<HTMLElement>("[data-hanko]")!;
    expect(hanko("exp-skg-software")).toHaveTextContent("二〇二六");
    expect(hanko("exp-fpt-university")).toHaveTextContent("二〇二五");
    expect(hanko("exp-fpt-japan")).toHaveTextContent("二〇二四");
    for (const anchor of ["exp-skg-software", "exp-fpt-japan"]) {
      expect(hanko(anchor)).toHaveAttribute("aria-hidden", "true");
      expect(hanko(anchor)).toHaveAttribute("lang", "ja");
    }
    expect(hanko("exp-skg-software")).toHaveAttribute("data-state", "open");
    expect(hanko("exp-fpt-japan")).toHaveAttribute("data-state", "closed");
    await user.click(toggle("exp-fpt-japan"));
    expect(hanko("exp-fpt-japan")).toHaveAttribute("data-state", "open");
  });

  it("puts the SKG projects under SKG newest first and the university projects under FPT University", () => {
    renderExperience();
    const skg = panelOf("exp-skg-software");
    const uni = panelOf("exp-fpt-university");
    expect([...skg.querySelectorAll("[id^='tree-']")].map((n) => n.id)).toEqual(
      [
        "tree-skg-ai-agent",
        "tree-skg-flexybox-p2",
        "tree-skg-coa",
        "tree-skg-flexybox-p1",
        "tree-tongue-ai-driver-ms",
      ],
    );
    expect([...uni.querySelectorAll("[id^='tree-']")].map((n) => n.id)).toEqual(
      ["tree-siteplus", "tree-zodiacgems", "tree-meet-my-lecturer"],
    );
  });

  it("keeps the school degree, major, GPA and notes, and FPT Japan's summary and tech", () => {
    renderExperience();
    const school = byId("exp-fpt-university");
    expect(school).toHaveTextContent(
      "Bachelor of Information Technology · Software Engineering",
    );
    expect(school).toHaveTextContent("GPA 7.66/10");
    expect(school).toHaveTextContent("Half-tuition scholarship (July 2021)");
    const japan = base.experiences.find((e) => e.id === "fpt-japan")!;
    const fptJapan = byId("exp-fpt-japan");
    expect(fptJapan).toHaveTextContent(japan.position.en);
    expect(fptJapan).toHaveTextContent(japan.summary.en);
    for (const name of japan.tech) expect(fptJapan).toHaveTextContent(name);
  });

  it("child card shows summary, tech, links", () => {
    renderExperience();
    for (const p of base.projects.filter((x) => x.kind !== "personal")) {
      const card = byId(`tree-${p.id}`);
      expect(card).toHaveTextContent(p.title);
      expect(card).toHaveTextContent(p.summary.en);
      expect(card).toHaveTextContent(p.role.en);
      for (const name of p.tech.slice(0, 5))
        expect(within(card).getByText(name)).toBeInTheDocument();
      if (p.tech.length > 5) {
        expect(card).toHaveTextContent(`+${p.tech.length - 5} more`);
        expect(within(card).queryByText(p.tech[5])).toBeNull();
      }
      if (p.teamSize)
        expect(card).toHaveTextContent(`Team size: ${p.teamSize}`);
      const hrefs = [...card.querySelectorAll("a")].map((a) =>
        a.getAttribute("href"),
      );
      for (const url of [
        ...(p.demoUrl ? [p.demoUrl] : []),
        ...p.repoUrls,
        ...p.links.map((l) => l.url),
      ])
        expect(hrefs).toContain(url);
    }
  });

  it("shows periods in the locale: 'Apr 2026 – Sep 2026' in EN and '2026年4月 – 2026年9月' in JA", () => {
    const { unmount } = renderExperience();
    expect(byId("tree-skg-ai-agent")).toHaveTextContent("Apr 2026 – Sep 2026");
    unmount();
    renderExperience({ locale: "ja" });
    expect(byId("tree-skg-ai-agent")).toHaveTextContent(
      "2026年4月 – 2026年9月",
    );
    expect(within(toggle("exp-fpt-university")).getByText("3件のプロジェクト"));
  });

  it("role highlight marks children with the role, order unchanged", async () => {
    const user = userEvent.setup();
    renderExperience({ withSwitcher: true });
    const order = childIds();
    const matched = () =>
      [...document.querySelectorAll("[data-role-match='true']")].map(
        (n) => n.id,
      );
    expect(matched()).toEqual(
      base.projects
        .filter((p) => p.kind !== "personal" && p.roles.includes("fullstack"))
        .map((p) => `tree-${p.id}`)
        .sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    );
    await user.click(screen.getByRole("radio", { name: "Project Manager" }));
    expect(matched()).toEqual([
      "tree-skg-ai-agent",
      "tree-skg-flexybox-p2",
      "tree-skg-flexybox-p1",
    ]);
    expect(childIds()).toEqual(order);
  });

  it("leaves out personal projects and unpublished stints", () => {
    const content: Content = {
      ...base,
      experiences: base.experiences.map((e) =>
        e.id === "fpt-japan" ? { ...e, published: false } : e,
      ),
    };
    renderExperience({ content });
    expect(document.getElementById("exp-fpt-japan")).toBeNull();
    for (const p of base.projects.filter((x) => x.kind === "personal"))
      expect(document.getElementById(`tree-${p.id}`)).toBeNull();
  });

  it("expands the parent of a #tree- hash on load", async () => {
    window.history.replaceState(null, "", "/en#tree-siteplus");
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderExperience();
    await waitFor(() => expect(isOpen("exp-fpt-university")).toBe(true));
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts.at(-1)).toBe(byId("tree-siteplus"));
  });

  it("expands a parent when the hash changes to it or to one of its children", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderExperience();
    expect(isOpen("exp-fpt-japan")).toBe(false);
    window.history.replaceState(null, "", "/en#exp-fpt-japan");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(isOpen("exp-fpt-japan")).toBe(true));
    window.history.replaceState(null, "", "/en#tree-zodiacgems");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(isOpen("exp-fpt-university")).toBe(true));
  });
});

describe("Case study sheet", () => {
  it("case study button opens the sheet, and Esc returns focus", async () => {
    const user = userEvent.setup();
    renderExperience();
    const trigger = within(byId("tree-skg-ai-agent")).getByRole("button", {
      name: /AI Agent/,
    });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    for (const name of ["Problem", "Role", "Decisions", "Result"])
      expect(within(dialog).getByRole("heading", { name })).toBeInTheDocument();
    const cs = base.projects.find((p) => p.id === "skg-ai-agent")!.caseStudy!;
    expect(within(dialog).getByText(cs.problem.en)).toBeInTheDocument();
    expect(within(dialog).getByText(cs.result.en)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it("does not give children without a case study a case study button", () => {
    renderExperience();
    expect(
      within(byId("tree-zodiacgems")).queryByRole("button", {
        name: /case study/i,
      }),
    ).toBeNull();
    expect(
      within(byId("tree-skg-coa")).getByRole("button", {
        name: /View case study/,
      }),
    ).toHaveAttribute("aria-haspopup", "dialog");
  });
});
