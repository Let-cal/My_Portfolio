import { render, screen, waitFor, within } from "@testing-library/react";
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

  it("shows the SKG stint lines from the data, newest first", () => {
    renderExperience();
    const text = byId("exp-skg-software").querySelector(
      "[data-journey-lines]",
    )!.textContent!;
    expect(text).toContain(
      "Software Engineer — acting Project Manager / Tech Lead",
    );
    expect(text).toContain("Oct 2025 – Sep 2026");
    expect(text).toContain("Software Engineer Intern");
    expect(text).toContain("Aug 2025 – Oct 2025");
    expect(text.indexOf("acting Project Manager")).toBeLessThan(
      text.indexOf("Software Engineer Intern"),
    );
    expect(toggle("exp-skg-software")).toHaveTextContent("Aug 2025 – Sep 2026");
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
      for (const name of p.tech.slice(0, 8))
        expect(within(card).getByText(name)).toBeInTheDocument();
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

  it("does not make children without a case study clickable", () => {
    renderExperience();
    expect(within(byId("tree-zodiacgems")).queryByRole("button")).toBeNull();
  });
});
