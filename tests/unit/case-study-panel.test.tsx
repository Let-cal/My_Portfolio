import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import seed from "@/content/seed.json";
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
    expect(within(dialog).getByText("1 of 6")).toBeInTheDocument();
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
