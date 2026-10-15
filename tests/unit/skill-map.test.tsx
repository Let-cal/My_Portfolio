import { act, render, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi_ from "@/messages/vi.json";
import seed from "@/content/seed.json";
import { contentSchema, type Content, type Locale } from "@/content/schema";
import { orderSkillGroups } from "@/lib/roles";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/en",
}));

import { Experience } from "@/components/sections/Experience";
import { Projects } from "@/components/sections/Projects";
import { Skills } from "@/components/sections/Skills";
import { stubIntersectionObserver } from "../helpers/io-stub";
import { HighlightProvider } from "@/components/site/HighlightProvider";
import { RoleProvider, useRole } from "@/components/site/RoleProvider";

const base: Content = contentSchema.parse(seed);
const messages = { en, ja, vi: vi_ } as const;

it("references a shared external brand sprite instead of repeating path data in the page", () => {
  const { container } = renderSkills();
  const glyphs = [...container.querySelectorAll("[data-skill-icon] use")];
  expect(glyphs.length).toBeGreaterThan(20);
  expect(glyphs.every(node => node.getAttribute("href")?.startsWith("/images/skill-sprite.svg#skill-icon-"))).toBe(true);
  expect(container.querySelector("symbol")).toBeNull();
});

function RolePicker() {
  const { setRole } = useRole();
  return (
    <button type="button" onClick={() => setRole("pm")}>
      pick pm
    </button>
  );
}

function renderSkills(opts: { role?: string; locale?: Locale; withCards?: boolean; picker?: boolean } = {}) {
  search.value = opts.role ? `role=${opts.role}` : "";
  const locale = opts.locale ?? "en";
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <RoleProvider>
        <HighlightProvider>
          {opts.picker && <RolePicker />}
          {opts.withCards && (
            <>
              <Experience content={base} locale={locale} />
              <Projects content={base} locale={locale} />
            </>
          )}
          <Skills content={base} locale={locale} />
        </HighlightProvider>
      </RoleProvider>
    </NextIntlClientProvider>,
  );
}

const section = () => document.getElementById("skills") as HTMLElement;
/** The skill chip whose accessible name starts with `name`. */
const chip = (name: string) => {
  const el = [...section().querySelectorAll<HTMLElement>("[data-skill-chip]")].find((c) => c.getAttribute("data-skill-name") === name);
  if (!el) throw new Error(`chip ${name} not found`);
  return el;
};
const groupOrder = () => [...section().querySelectorAll("[data-skill-group]")].map((n) => n.getAttribute("data-skill-group"));
const screenText = () => section().querySelector("[data-terminal-screen]")?.textContent ?? "";

/** Chips sit on the left, evidence cards on the right, the container spans both. */
function mockRects() {
  return vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const mk = (x: number, y: number, w: number, h: number) =>
      ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON() {} }) as DOMRect;
    if (this.hasAttribute("data-evidence-card")) return mk(600, 100, 240, 60);
    if (this.hasAttribute("data-skill-chip")) {
      // Each group sits 200px lower than the one before, so reordering the groups moves the chips.
      const at = [...document.querySelectorAll("[data-skill-group]")].indexOf(this.closest("[data-skill-group]")!);
      return mk(20, 40 + 200 * at, 90, 32);
    }
    return mk(0, 0, 900, 700);
  });
}

function reducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  // Skills contains <Reveal>, whose whileInView needs an IntersectionObserver.
  stubIntersectionObserver();
  reducedMotion(false);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // Remove the stub so other tests see jsdom's default (no matchMedia).
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("Skills section", () => {
  it("owns a stable opaque surface for each group instead of a scroll-measured overlay", () => {
    renderSkills();
    for (const group of section().querySelectorAll("[data-skill-group]")) {
      expect(group).toHaveAttribute("data-scene-avoid", "box");
      expect(group).toHaveAttribute("data-scene-veil", "off");
      expect(group.querySelector(":scope > [data-skill-surface]")).toHaveAttribute("aria-hidden", "true");
    }
    expect(section().querySelector("#skills-evidence")).toHaveAttribute("data-scene-veil", "off");
    expect(section().querySelector("[data-skill-terminal]")).toHaveAttribute("data-scene-veil", "off");
  });
  it("is a section labelled by its heading", () => {
    renderSkills();
    expect(within(section()).getByRole("heading", { level: 2, name: "Skills" })).toBeInTheDocument();
  });

  it("orders the skill groups by the current role", () => {
    renderSkills();
    expect(groupOrder()).toEqual(orderSkillGroups(base.roles.find((r) => r.key === "fullstack")!));
  });

  it("puts the PM groups first for ?role=pm", async () => {
    renderSkills({ role: "pm" });
    const pm = base.roles.find((r) => r.key === "pm")!;
    await waitFor(() => expect(groupOrder()).toEqual(orderSkillGroups(pm)));
    expect(groupOrder()[0]).toBe("delivery");
  });

  it("shows every skill name and no progress indicators", () => {
    renderSkills();
    for (const s of base.skills) {
      expect(within(section()).getAllByText(s.name).length).toBeGreaterThan(0);
    }
    expect(within(section()).queryAllByRole("progressbar")).toHaveLength(0);
    expect(section().textContent).not.toMatch(/\d\s*%/);
  });

  it("runs two marquees in opposite directions", () => {
    renderSkills();
    const tracks = section().querySelectorAll(".fx-marquee-track");
    expect(tracks).toHaveLength(2);
    expect([...tracks].filter((t) => t.hasAttribute("data-reverse"))).toHaveLength(1);
  });

  it("gives skills with a brand icon an inline svg and the rest a monogram tile", () => {
    renderSkills();
    expect(chip("Next.js").querySelector("svg[data-skill-icon]")).not.toBeNull();
    expect(chip("Oracle").querySelector("svg[data-skill-icon]")).toBeNull();
    expect(chip("Oracle").querySelector("[data-skill-monogram]")).not.toBeNull();
  });

  it("starts with no skill selected and nothing drawn", () => {
    renderSkills();
    expect(chip("Next.js")).toHaveAttribute("aria-pressed", "false");
    expect(section().querySelectorAll("[data-evidence-card]")).toHaveLength(0);
    expect(section().querySelector("svg[data-beam]")).toBeNull();
  });
});

describe("Skills evidence", () => {
  it("lists the related experiences in the panel when a skill is clicked", async () => {
    const user = userEvent.setup();
    renderSkills();
    await user.click(chip("Next.js"));
    expect(chip("Next.js")).toHaveAttribute("aria-pressed", "true");
    const panel = within(section()).getByRole("region", { name: /Evidence/i });
    for (const name of ["FlexyBox Phase 2", "FlexyBox Phase 1", "TONGUE-AI & Driver MS"]) {
      expect(within(panel).getByText(name)).toBeInTheDocument();
    }
    expect(panel.querySelectorAll("[data-evidence-card]")).toHaveLength(3);
  });

  it("links each card to its #exp-/#proj- anchor and lists projects too", async () => {
    const user = userEvent.setup();
    renderSkills();
    await user.click(chip("React"));
    const links = [...section().querySelectorAll<HTMLAnchorElement>("[data-evidence-card] a")].map((a) => a.getAttribute("href"));
    expect(links).toEqual(
      expect.arrayContaining(["#exp-skg-ai-agent", "#exp-skg-flexybox-p2", "#proj-siteplus", "#proj-zodiacgems"]),
    );
  });

  it("says so when a skill has no linked evidence", async () => {
    const user = userEvent.setup();
    renderSkills();
    await user.click(chip("Framer Motion"));
    expect(section().querySelectorAll("[data-evidence-card]")).toHaveLength(0);
    expect(within(section()).getByText(/No linked experience or project/i)).toBeInTheDocument();
  });

  it("clicking the selected skill again clears the selection", async () => {
    const user = userEvent.setup();
    renderSkills();
    await user.click(chip("Next.js"));
    await user.click(chip("Next.js"));
    expect(chip("Next.js")).toHaveAttribute("aria-pressed", "false");
    expect(section().querySelectorAll("[data-evidence-card]")).toHaveLength(0);
  });

  it("draws one beam path per evidence card", async () => {
    mockRects();
    const user = userEvent.setup();
    renderSkills();
    await user.click(chip("Next.js"));
    await waitFor(() => expect(section().querySelectorAll("svg[data-beam] path")).toHaveLength(3));
    await user.click(chip("React"));
    await waitFor(() => expect(section().querySelectorAll("svg[data-beam] path")).toHaveLength(4));
    for (const p of section().querySelectorAll("svg[data-beam] path")) {
      expect(p.getAttribute("d")).toMatch(/^M[\d.\s,-]+C/);
    }
  });

  it("re-measures the beams when a role change reorders the groups", async () => {
    mockRects();
    const user = userEvent.setup();
    renderSkills({ picker: true });
    await user.click(chip("Next.js"));
    const beamD = () => section().querySelector("svg[data-beam] path")?.getAttribute("d");
    await waitFor(() => expect(beamD()).toBeTruthy());
    // Let the post-selection settle pass run first, so only the role change can move the beam.
    await new Promise((r) => setTimeout(r, 450));
    const before = beamD();
    await user.click(document.querySelector("button:not([data-skill-chip])") as HTMLElement);
    await waitFor(() => expect(groupOrder()[0]).toBe("delivery"));
    await waitFor(() => expect(beamD()).not.toBe(before), { timeout: 250 });
    expect(section().querySelectorAll("svg[data-beam] path")).toHaveLength(3);
  });

  it("removes the beams when the selection is cleared", async () => {
    mockRects();
    const user = userEvent.setup();
    renderSkills();
    await user.click(chip("Next.js"));
    await user.click(chip("Next.js"));
    expect(section().querySelector("svg[data-beam]")).toBeNull();
  });

  it("marks the related #exp-/#proj- elements data-highlight through the provider", async () => {
    const user = userEvent.setup();
    renderSkills({ withCards: true });
    const exp = (id: string) => document.getElementById(`exp-${id}`) as HTMLElement;
    expect(exp("skg-flexybox-p2")).not.toHaveAttribute("data-highlight");
    await user.click(chip("Next.js"));
    for (const id of ["skg-flexybox-p2", "skg-flexybox-p1", "skg-intern"]) expect(exp(id)).toHaveAttribute("data-highlight", "true");
    expect(exp("skg-coa")).not.toHaveAttribute("data-highlight");
    await user.click(chip("React"));
    expect(document.getElementById("proj-siteplus")).toHaveAttribute("data-highlight", "true");
    expect(exp("skg-intern")).not.toHaveAttribute("data-highlight");
    await user.click(chip("React"));
    expect(document.getElementById("proj-siteplus")).not.toHaveAttribute("data-highlight");
  });
});

describe("Skills terminal", () => {
  const terminal = () => section().querySelector("[data-skill-terminal]") as HTMLElement;

  it("holds the skills --group command for assistive tech from the start", () => {
    renderSkills();
    expect(terminal().textContent).toContain("skills --group");
  });

  it("types whoami, then skills --group <first group>, then prints the skills", async () => {
    vi.useFakeTimers();
    // The terminal types once it is on screen, so this test needs an observer that reports it visible.
    stubIntersectionObserver({ visible: true });
    renderSkills();
    expect(screenText()).not.toContain("whoami");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screenText()).toMatch(/\$ w/);
    expect(screenText()).not.toContain("skills --group");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });
    expect(screenText()).toContain("$ whoami");
    expect(screenText()).toContain("Le Tran Cat Lam");
    expect(screenText()).toContain("Full-stack Software Engineer");
    expect(screenText()).toContain("$ skills --group languages");
    expect(screenText()).toContain("TypeScript");
  });

  it("shows everything at once under reduced motion, and stops the marquees", () => {
    reducedMotion(true);
    renderSkills();
    expect(screenText()).toContain("$ whoami");
    expect(screenText()).toContain("$ skills --group languages");
    expect(screenText()).toContain("TypeScript");
    expect(section().querySelectorAll(".fx-marquee-track[data-static]")).toHaveLength(2);
  });

  it("follows the selected skill's group", async () => {
    reducedMotion(true);
    const user = userEvent.setup();
    renderSkills();
    await user.click(chip("Terraform"));
    expect(screenText()).toContain("$ skills --group cloud");
    expect(screenText()).toContain("Terraform");
  });

  it("follows a group header, and the role's title in whoami", async () => {
    reducedMotion(true);
    const user = userEvent.setup();
    renderSkills({ role: "pm" });
    await waitFor(() => expect(screenText()).toContain("Project Manager"));
    expect(screenText()).toContain("$ skills --group delivery");
    await user.click(section().querySelector<HTMLElement>('[data-skill-group="testing"] button')!);
    expect(screenText()).toContain("$ skills --group testing");
  });

  it("has a single polite live region carrying only the final output", () => {
    reducedMotion(true);
    renderSkills();
    const live = terminal().querySelectorAll("[aria-live]");
    expect(live).toHaveLength(1);
    expect(live[0]).toHaveAttribute("aria-live", "polite");
    expect(live[0].textContent).toContain("TypeScript");
    expect(live[0].textContent).not.toContain("whoami");
  });

  it("uses translated group labels (ja)", () => {
    renderSkills({ locale: "ja" });
    expect(within(section()).getByRole("heading", { level: 2 })).toHaveTextContent(ja.sections.skills);
    expect(section().querySelector('[data-skill-group="languages"]')?.textContent).toContain(ja.skills.groups.languages);
  });
});

describe("Skills keyboard and screen reader model", () => {
  it("gives each group a single chip tab stop and moves it with the arrow keys", async () => {
    const user = userEvent.setup();
    renderSkills();
    const groups = [...section().querySelectorAll<HTMLElement>("[data-skill-group]")];
    for (const g of groups) {
      expect(g.querySelectorAll('[data-skill-chip]:not([tabindex="-1"])')).toHaveLength(1);
    }
    const first = chip("TypeScript");
    const second = chip("JavaScript");
    expect(first).toHaveAttribute("tabindex", "0");
    expect(second).toHaveAttribute("tabindex", "-1");
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(second);
    expect(second).toHaveAttribute("tabindex", "0");
    expect(first).toHaveAttribute("tabindex", "-1");
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(chip("SQL"));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(first);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(chip("SQL"));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(first);
  });

  it("keeps the selected chip as its group's tab stop", async () => {
    const user = userEvent.setup();
    renderSkills();
    await user.click(chip("Node.js"));
    expect(chip("Node.js")).toHaveAttribute("tabindex", "0");
    expect(chip("Next.js")).toHaveAttribute("tabindex", "-1");
  });

  it("puts the evidence panel right after the groups in the DOM, and the terminal first", () => {
    renderSkills();
    const terminal = section().querySelector("[data-skill-terminal]")!;
    const groups = section().querySelector('[role="group"][aria-label="Skill groups"]')!;
    const panel = section().querySelector("#skills-evidence")!;
    const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(terminal, groups)).toBe(true);
    expect(follows(groups, panel)).toBe(true);
    expect(chip("Next.js")).toHaveAttribute("aria-controls", "skills-evidence");
  });

  it("marks the group shown in the terminal with aria-current, not aria-pressed", async () => {
    const user = userEvent.setup();
    renderSkills();
    const head = (g: string) => section().querySelector<HTMLElement>(`[data-skill-group="${g}"] h3 button`)!;
    expect(head("languages")).toHaveAttribute("aria-current", "true");
    expect(head("languages")).not.toHaveAttribute("aria-pressed");
    await user.click(head("testing"));
    expect(head("testing")).toHaveAttribute("aria-current", "true");
    expect(head("languages")).not.toHaveAttribute("aria-current");
  });

  it("announces the selection and its number of linked records politely", async () => {
    const user = userEvent.setup();
    renderSkills();
    const live = () =>
      [...section().querySelectorAll("[aria-live]")].find((n) => !n.closest("[data-skill-terminal]")) as HTMLElement;
    expect(live()).toHaveAttribute("aria-live", "polite");
    expect(live().textContent).toBe("");
    await user.click(chip("Next.js"));
    expect(live().textContent).toBe("Next.js — 3 linked records");
    await user.click(chip("Next.js"));
    expect(live().textContent).toBe("");
  });
});
