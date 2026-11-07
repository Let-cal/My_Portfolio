import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import seed from "@/content/seed.json";

// The toast outlet is not mounted here: the toast is recorded instead.
const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/site/toast-readiness", () => ({
  ensureToaster: () => Promise.resolve(),
}));
// The figures view is its own lazy chunk; here it renders at once.
vi.mock(
  "@/components/sections/case-study/figures/LazyFigureScroll",
  async () => {
    const { FigureScroll } =
      await import("@/components/sections/case-study/figures/FigureScroll");
    return { LazyFigureScroll: FigureScroll };
  },
);
vi.mock(
  "@/components/sections/case-study/figures/LazyFigureViewer",
  async () => {
    const { FigureViewer } =
      await import("@/components/sections/case-study/figures/FigureViewer");
    return { LazyFigureViewer: FigureViewer };
  },
);
import { contentSchema, type Content } from "@/content/schema";
import {
  CaseStudyPanel,
  type CaseStudyItem,
} from "@/components/sections/case-study/CaseStudyPanel";
import { useCaseParam } from "@/components/sections/case-study/use-case-param";
import { archiveRows } from "@/lib/archive";
import { caseItemFromRow } from "@/lib/case-items";
import type { CaseContext } from "@/lib/case-list";

const content: Content = contentSchema.parse(seed);
const NOW = new Date(2026, 9, 30);

/** Every seed project with a case study, newest first (the archive's order). */
const items: CaseStudyItem[] = archiveRows(content, "en", NOW).flatMap(
  (row) => {
    const item = caseItemFromRow(row, en.archive.kinds[row.whereKind]);
    return item ? [item] : [];
  },
);
const byId = (id: string) => items.find((i) => i.id === id)!;

let resizeCallbacks: ResizeObserverCallback[] = [];

function stubLayoutApis(narrow = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: narrow && query.includes("max-width: 1023px"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  resizeCallbacks = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: ResizeObserverCallback) {
        resizeCallbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

/** The panel wired the way the sections wire it: owner state, the deep-link hook and a return-focus ref. */
function Harness({
  list = items,
  context = "archive",
  initial = null,
}: {
  list?: CaseStudyItem[];
  context?: CaseContext;
  initial?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(initial);
  const open = useCaseParam(list, setOpenId, context);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  return (
    <>
      <input aria-label="outside field" />
      <CaseStudyPanel
        items={list}
        openId={openId}
        context={context}
        onOpenChange={open}
        returnFocusRef={returnFocusRef}
      />
    </>
  );
}

function renderPanel(props: Parameters<typeof Harness>[0] = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Harness {...props} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  stubLayoutApis();
  window.history.replaceState(null, "", "/en/projects");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CaseStudyPanel", () => {
  it("renders result first then problem role decisions", async () => {
    renderPanel({ initial: "skg-ai-agent" });
    const dialog = await screen.findByRole("dialog", { name: "AI Agent" });
    const headings = within(dialog)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Result", "Problem", "Role", "Decisions"]);
    const cs = byId("skg-ai-agent").caseStudy;
    for (const text of [cs.result, cs.problem, cs.role, cs.decisions])
      expect(within(dialog).getByText(text)).toBeInTheDocument();
    // Meta row: role, team, period with duration, where (kind).
    expect(within(dialog).getByText("3 → 6")).toBeInTheDocument();
    expect(
      within(dialog).getByText(`${byId("skg-ai-agent").period} · 6 mos`),
    ).toBeInTheDocument();
  });

  it("the Where line shows the kind's crest beside its label", async () => {
    renderPanel({ initial: "siteplus" });
    const dialog = await screen.findByRole("dialog");
    const crest = dialog.querySelector(".kamon")!;
    expect(crest).toHaveAttribute("data-kind", "university");
    expect(crest).toHaveAttribute("aria-hidden", "true");
    expect(crest.parentElement).toHaveTextContent(en.archive.kinds.university);
  });

  it("lists every tech chip", async () => {
    renderPanel({ initial: "skg-ai-agent" });
    const dialog = await screen.findByRole("dialog");
    const tech = byId("skg-ai-agent").tech;
    expect(tech.length).toBeGreaterThan(8);
    const list = within(dialog).getByRole("list", { name: /Tech stack/ });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(tech);
  });

  it("next button names the next project and moves to it", async () => {
    const user = userEvent.setup();
    renderPanel({ initial: "skg-ai-agent" });
    const dialog = await screen.findByRole("dialog", { name: "AI Agent" });
    // Circular: the oldest project with a case study comes before the newest.
    expect(
      within(dialog).getByRole("button", {
        name: /Previous project: SitePlus/,
      }),
    ).toBeInTheDocument();
    // The position is stated once, in the live region with the title.
    expect(within(dialog).getByText("AI Agent, 1 of 6")).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", {
        name: /Next project: FlexyBox Phase 2/,
      }),
    );
    expect(
      await screen.findByRole("dialog", { name: "FlexyBox Phase 2" }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("?case=skg-flexybox-p2");
  });

  it("announces the project and its position to screen readers after previous / next", async () => {
    const user = userEvent.setup();
    renderPanel({ initial: "skg-ai-agent" });
    const dialog = await screen.findByRole("dialog", { name: "AI Agent" });
    const live = within(dialog).getByText("AI Agent, 1 of 6");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveClass("sr-only");
    await user.click(
      within(dialog).getByRole("button", {
        name: /Next project: FlexyBox Phase 2/,
      }),
    );
    await screen.findByRole("dialog", { name: "FlexyBox Phase 2" });
    // The same region (so it is announced as a change), now naming the new project.
    expect(live).toBeInTheDocument();
    expect(live).toHaveTextContent("FlexyBox Phase 2, 2 of 6");
  });

  it("arrow keys move between projects but not inside inputs", async () => {
    const user = userEvent.setup();
    renderPanel({ initial: "skg-ai-agent" });
    await screen.findByRole("dialog", { name: "AI Agent" });
    await user.keyboard("{ArrowRight}");
    expect(
      await screen.findByRole("dialog", { name: "FlexyBox Phase 2" }),
    ).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(
      await screen.findByRole("dialog", { name: "AI Agent" }),
    ).toBeInTheDocument();
    // A keypress whose target is a text field is left to the field.
    const field = screen.getByRole("textbox", {
      name: "outside field",
      hidden: true,
    });
    act(() => {
      field.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(
      screen.getByRole("dialog", { name: "AI Agent" }),
    ).toBeInTheDocument();
    // Modified arrows (Alt+← is the browser's Back) are left alone too.
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(
      screen.getByRole("dialog", { name: "AI Agent" }),
    ).toBeInTheDocument();
  });

  it("switches to scroll mode when content overflows", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute("data-case-content") ? 900 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute("data-case-content") ? 600 : 0;
      },
    );
    renderPanel({ initial: "skg-flexybox-p2" });
    const dialog = await screen.findByRole("dialog");
    const contentEl = dialog.querySelector("[data-case-content]")!;
    await waitFor(() =>
      expect(contentEl).toHaveAttribute("data-mode", "scroll"),
    );
  });

  it("stays wide when the content fits, and re-measures on resize", async () => {
    let tall = false;
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute("data-case-content") ? (tall ? 900 : 600) : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute("data-case-content") ? 600 : 0;
      },
    );
    renderPanel({ initial: "skg-coa" });
    const dialog = await screen.findByRole("dialog");
    const contentEl = dialog.querySelector("[data-case-content]")!;
    await waitFor(() => expect(contentEl).toHaveAttribute("data-mode", "wide"));
    tall = true;
    act(() => {
      for (const cb of resizeCallbacks) cb([], {} as ResizeObserver);
    });
    expect(contentEl).toHaveAttribute("data-mode", "scroll");
  });

  it("uses the scrolling one-column mode on a small viewport", async () => {
    stubLayoutApis(true);
    renderPanel({ initial: "skg-coa" });
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.querySelector("[data-case-content]")).toHaveAttribute(
        "data-mode",
        "scroll",
      ),
    );
  });

  it("does not reset to wide first when the small-viewport query matches", async () => {
    stubLayoutApis(true);
    const modes: string[] = [];
    const original = Element.prototype.setAttribute;
    vi.spyOn(Element.prototype, "setAttribute").mockImplementation(function (
      this: Element,
      name: string,
      value: string,
    ) {
      if (name === "data-mode") modes.push(value);
      return original.call(this, name, value);
    });
    renderPanel({ initial: "skg-coa" });
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.querySelector("[data-case-content]")).toHaveAttribute(
        "data-mode",
        "scroll",
      ),
    );
    expect(modes).not.toContain("wide");
    expect(modes.length).toBeGreaterThan(0);
  });

  it("re-measures when a web font finishes loading after fonts.ready", async () => {
    let tall = false;
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute("data-case-content") ? (tall ? 900 : 600) : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute("data-case-content") ? 600 : 0;
      },
    );
    const fonts = new EventTarget();
    Object.defineProperty(fonts, "ready", { value: Promise.resolve() });
    // jsdom has no FontFaceSet.
    Object.defineProperty(document, "fonts", {
      value: fonts,
      configurable: true,
    });
    try {
      renderPanel({ initial: "skg-coa" });
      const dialog = await screen.findByRole("dialog");
      const contentEl = dialog.querySelector("[data-case-content]")!;
      await waitFor(() =>
        expect(contentEl).toHaveAttribute("data-mode", "wide"),
      );
      // A Japanese face arrives late (a lazily used unicode-range subset): the text grows past the panel.
      tall = true;
      act(() => {
        fonts.dispatchEvent(new Event("loadingdone"));
      });
      expect(contentEl).toHaveAttribute("data-mode", "scroll");
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  it("keeps the reading position when a resize re-measures the scrolling layout", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute("data-case-content") ? 900 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute("data-case-content") ? 600 : 0;
      },
    );
    renderPanel({ initial: "skg-flexybox-p2" });
    const dialog = await screen.findByRole("dialog");
    const contentEl = dialog.querySelector<HTMLElement>("[data-case-content]")!;
    await waitFor(() =>
      expect(contentEl).toHaveAttribute("data-mode", "scroll"),
    );
    // A browser clamps the scroll position while the shorter wide layout is tried; jsdom does not, so mimic it.
    let top = 250;
    Object.defineProperty(contentEl, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value;
      },
    });
    const setAttribute = contentEl.setAttribute.bind(contentEl);
    vi.spyOn(contentEl, "setAttribute").mockImplementation((name, value) => {
      if (name === "data-mode" && value === "wide") top = 0;
      setAttribute(name, value);
    });
    act(() => {
      for (const cb of resizeCallbacks) cb([], {} as ResizeObserver);
    });
    expect(contentEl).toHaveAttribute("data-mode", "scroll");
    expect(top).toBe(250);
  });

  it("names the dialog by the project and describes it by where it was done", async () => {
    renderPanel({ initial: "skg-coa" });
    const dialog = await screen.findByRole("dialog", { name: /^COA/ });
    expect(dialog).toHaveAccessibleDescription(
      `${byId("skg-coa").where} · Software Engineer`,
    );
  });

  it("states the position once for screen readers", async () => {
    renderPanel({ initial: "skg-coa" });
    const dialog = await screen.findByRole("dialog");
    const position = en.caseStudy.position
      .replace("{index}", String(items.indexOf(byId("skg-coa")) + 1))
      .replace("{total}", String(items.length));
    expect(within(dialog).getAllByText(new RegExp(position))).toHaveLength(1);
  });

  it("forgets the reload guard of a project once its panel has loaded", async () => {
    window.sessionStorage.setItem("case-reload:skg-coa", "1");
    window.sessionStorage.setItem("case-reload:siteplus", "1");
    renderPanel({ initial: "skg-coa" });
    await screen.findByRole("dialog");
    await waitFor(() =>
      expect(window.sessionStorage.getItem("case-reload:skg-coa")).toBeNull(),
    );
    expect(window.sessionStorage.getItem("case-reload:siteplus")).toBe("1");
    window.sessionStorage.clear();
  });

  it("when the clipboard refuses, says so and shows the link to copy by hand", async () => {
    const user = userEvent.setup();
    toast.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    renderPanel({ initial: "skg-coa" });
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(en.caseStudy.copyFailed, {
      description: "http://localhost:3000/en/projects?case=skg-coa",
    });
  });

  it("copies the ?case= link and confirms with a toast", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderPanel({ initial: "skg-coa" });
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith(
      "http://localhost:3000/en/projects?case=skg-coa",
    );
  });

  it("shows the chapter of the list it was opened from on the spine", async () => {
    renderPanel({ initial: "skg-coa", context: "tree" });
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("第一章 経歴");
  });
});

describe("useCaseParam", () => {
  it("opens from ?case= on load", async () => {
    window.history.replaceState(null, "", "/en/projects?case=skg-coa");
    renderPanel();
    expect(
      await screen.findByRole("dialog", { name: /^COA/ }),
    ).toBeInTheDocument();
  });

  it("ignores an unknown ?case= id and removes it from the URL", async () => {
    window.history.replaceState(null, "", "/en/projects?kind=work&case=nope");
    renderPanel();
    await waitFor(() => expect(window.location.search).toBe("?kind=work"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("writes ?case= on open and removes it on close", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/en/projects?case=skg-coa#top");
    renderPanel();
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#top");
  });

  it("lets the tree claim an id that the bento also lists", async () => {
    window.history.replaceState(null, "", "/en?case=siteplus");
    const siteplus = [byId("siteplus")];
    const opened: string[] = [];
    function Owner({ context }: { context: CaseContext }) {
      const [openId, setOpenId] = useState<string | null>(null);
      useCaseParam(siteplus, setOpenId, context);
      if (openId) opened.push(`${context}:${openId}`);
      return null;
    }
    render(
      <>
        <Owner context="bento" />
        <Owner context="tree" />
      </>,
    );
    await waitFor(() => expect(opened).toContain("tree:siteplus"));
    expect(opened.some((o) => o.startsWith("bento"))).toBe(false);
  });
});

describe("CaseStudyPanel figures view", () => {
  const siteplus = byId("siteplus");
  /** Three projects: two with figures, the last without. */
  const withFigures: CaseStudyItem[] = [
    siteplus,
    { ...byId("skg-coa"), figures: siteplus.figures.slice().reverse() },
    { ...byId("skg-ai-agent"), figures: [] },
  ];

  it("shows the 文 / 図 control only when the project has figures, with aria-pressed", async () => {
    expect(siteplus.figures).toHaveLength(2);
    renderPanel({ list: withFigures, initial: "siteplus" });
    const dialog = await screen.findByRole("dialog", { name: "SitePlus" });
    const content = within(dialog).getByRole("button", { name: "Content" });
    const figs = within(dialog).getByRole("button", { name: "Figures · 2" });
    expect(content).toHaveAttribute("aria-pressed", "true");
    expect(figs).toHaveAttribute("aria-pressed", "false");
    // In reading order after the title.
    const title = within(dialog).getByRole("heading", { name: "SitePlus" });
    expect(
      title.compareDocumentPosition(figs) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // A project without figures has no control.
    await userEvent
      .setup()
      .click(within(dialog).getByRole("button", { name: /Previous project/ }));
    const other = await screen.findByRole("dialog", { name: "AI Agent" });
    expect(within(other).queryByRole("button", { name: /Figures/ })).toBeNull();
    expect(within(other).queryByRole("button", { name: "Content" })).toBeNull();
  });

  it("switching to 図 writes fig=1 with replaceState, back to 文 removes it", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/en/projects?case=siteplus");
    const replace = vi.spyOn(window.history, "replaceState");
    const push = vi.spyOn(window.history, "pushState");
    renderPanel({ list: withFigures });
    const dialog = await screen.findByRole("dialog", { name: "SitePlus" });
    await user.click(
      within(dialog).getByRole("button", { name: "Figures · 2" }),
    );
    expect(
      within(dialog).getByRole("button", { name: "Figures · 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("tablist")).toBeInTheDocument();
    // The result banner and panes give way to the stage.
    expect(within(dialog).queryByText(siteplus.caseStudy.problem)).toBeNull();
    await waitFor(() =>
      expect(window.location.search).toBe("?case=siteplus&fig=1"),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Next figure" }),
    );
    await waitFor(() =>
      expect(window.location.search).toBe("?case=siteplus&fig=2"),
    );
    await user.click(within(dialog).getByRole("button", { name: "Content" }));
    await waitFor(() => expect(window.location.search).toBe("?case=siteplus"));
    expect(
      within(dialog).getByText(siteplus.caseStudy.problem),
    ).toBeInTheDocument();
    expect(replace).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("opens straight on the figure of ?fig=, and on figure 1 when it is out of range", async () => {
    window.history.replaceState(null, "", "/en/projects?case=siteplus&fig=2");
    const { unmount } = renderPanel({ list: withFigures });
    const dialog = await screen.findByRole("dialog", { name: "SitePlus" });
    const tabs = await within(dialog).findAllByRole("tab");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    unmount();
    window.history.replaceState(null, "", "/en/projects?case=siteplus&fig=9");
    renderPanel({ list: withFigures });
    const again = await screen.findByRole("dialog", { name: "SitePlus" });
    const tabs2 = await within(again).findAllByRole("tab");
    expect(tabs2[0]).toHaveAttribute("aria-selected", "true");
    await waitFor(() =>
      expect(window.location.search).toBe("?case=siteplus&fig=1"),
    );
  });

  it("moving to the next project in 図 keeps 図 on figure 1 when it has figures and falls back to 文 when it has none", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/en/projects?case=siteplus&fig=2");
    renderPanel({ list: withFigures });
    const dialog = await screen.findByRole("dialog", { name: "SitePlus" });
    await within(dialog).findAllByRole("tab");
    await user.click(
      within(dialog).getByRole("button", { name: /Next project: COA/ }),
    );
    const coa = await screen.findByRole("dialog", { name: /^COA/ });
    const tabs = within(coa).getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(
      within(coa).getByRole("button", { name: "Figures · 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    await waitFor(() =>
      expect(window.location.search).toBe("?case=skg-coa&fig=1"),
    );
    await user.click(
      within(coa).getByRole("button", { name: /Next project: AI Agent/ }),
    );
    const agent = await screen.findByRole("dialog", { name: "AI Agent" });
    expect(within(agent).queryByRole("tablist")).toBeNull();
    expect(
      within(agent).getByText(byId("skg-ai-agent").caseStudy.problem),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(window.location.search).toBe("?case=skg-ai-agent"),
    );
  });

  it("in 図, ArrowRight moves the figure, not the project", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/en/projects?case=siteplus");
    renderPanel({ list: withFigures });
    const dialog = await screen.findByRole("dialog", { name: "SitePlus" });
    await user.click(
      within(dialog).getByRole("button", { name: "Figures · 2" }),
    );
    // Focus stays on the toggle (outside the filmstrip): the panel routes the arrows.
    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("dialog", { name: "SitePlus" }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole("tab")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // At the last figure nothing wraps and the project stays.
    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("dialog", { name: "SitePlus" }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole("tab")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{ArrowLeft}");
    expect(within(dialog).getAllByRole("tab")[0]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // The spine shows the figure position in kanji numerals.
    expect(dialog).toHaveTextContent("図 一／二");
  });

  it("the viewer opens above the panel, its arrows move its own figure, and Esc returns to the stage on that figure", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/en/projects?case=siteplus");
    renderPanel({ list: withFigures });
    const panel = await screen.findByRole("dialog", { name: "SitePlus" });
    await user.click(
      within(panel).getByRole("button", { name: "Figures · 2" }),
    );
    await user.click(within(panel).getByRole("button", { name: "Enlarge" }));
    const viewer = await screen.findByRole("dialog", {
      name: "SitePlus — Mobile site-survey screen",
    });
    expect(viewer).toHaveAttribute("aria-modal", "true");
    await user.keyboard("{ArrowRight}");
    expect(viewer).toHaveAccessibleName(
      "SitePlus — How the client, API and database connect",
    );
    // The panel moved with it (one step, not two) and is still on SitePlus.
    await waitFor(() =>
      expect(window.location.search).toBe("?case=siteplus&fig=2"),
    );
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /Mobile|client, API/ }),
      ).toBeNull(),
    );
    const panelAgain = screen.getByRole("dialog", { name: "SitePlus" });
    expect(within(panelAgain).getAllByRole("tab")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(panelAgain).getByRole("tabpanel")).toHaveFocus();
  });

  it("with full motion the text leaves before 図 shows, and a project move cancels that exit", async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.motion = "full";
    const anims: { cancel: ReturnType<typeof vi.fn> }[] = [];
    Object.defineProperty(HTMLElement.prototype, "animate", {
      value: vi.fn(() => {
        const animation = {
          cancel: vi.fn(),
          finished: new Promise<never>(() => {}),
        };
        anims.push(animation);
        return animation as unknown as Animation;
      }),
      configurable: true,
    });
    try {
      renderPanel({ list: withFigures, initial: "siteplus" });
      const dialog = await screen.findByRole("dialog", { name: "SitePlus" });
      await user.click(
        within(dialog).getByRole("button", { name: "Figures · 2" }),
      );
      // The result banner and the panes slide out first; the stage is not there yet.
      expect(anims).toHaveLength(2);
      expect(within(dialog).queryByRole("tablist")).toBeNull();
      await user.click(
        within(dialog).getByRole("button", { name: /Next project: COA/ }),
      );
      await screen.findByRole("dialog", { name: /^COA/ });
      for (const a of anims) expect(a.cancel).toHaveBeenCalled();
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
      delete document.documentElement.dataset.motion;
    }
  });

  it("closing in 図 removes case and fig from the URL", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/en/projects?case=siteplus&fig=2");
    renderPanel({ list: withFigures });
    await screen.findByRole("dialog", { name: "SitePlus" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.search).toBe("");
  });
});
