import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import seed from "@/content/seed.json";
import { contentSchema } from "@/content/schema";
import type { CaseStudyPanel } from "@/components/sections/case-study/CaseStudyPanel";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

/** The lazy panel stands in as a probe: the archive's props are recorded, nothing renders. */
type PanelProps = ComponentProps<typeof CaseStudyPanel>;
const panel = vi.hoisted(() => ({ calls: [] as PanelProps[] }));
vi.mock("@/components/sections/case-study/LazyCaseStudyPanel", () => ({
  LazyCaseStudyPanel: (props: PanelProps) => {
    panel.calls.push(props);
    return null;
  },
}));

import { ProjectArchive } from "@/components/sections/projects/ProjectArchive";
import { RoleProvider } from "@/components/site/RoleProvider";
import { archiveRows, groupByYear } from "@/lib/archive";
import { ARCHIVE_FILTER_CSS } from "@/lib/archive-filter";

const content = contentSchema.parse(seed);
const last = () => panel.calls[panel.calls.length - 1];

function renderArchive() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RoleProvider>
        <ProjectArchive groups={groupByYear(archiveRows(content, "en"))} />
      </RoleProvider>
    </NextIntlClientProvider>,
  );
}

/** Installs a stand-in for `document.startViewTransition` (jsdom has none). */
const setViewTransition = (fn: unknown) =>
  Object.defineProperty(document, "startViewTransition", {
    value: fn,
    configurable: true,
    writable: true,
  });

let style: HTMLStyleElement;
beforeEach(() => {
  panel.calls = [];
  window.history.replaceState(null, "", "/en/projects");
  style = document.createElement("style");
  style.textContent = ARCHIVE_FILTER_CSS;
  document.head.append(style);
});
afterEach(() => {
  style.remove();
  Reflect.deleteProperty(document, "startViewTransition");
  vi.restoreAllMocks();
});

describe("ProjectArchive opening a case study", () => {
  it("still opens, with no transition name left behind, when a View Transition throws at once", async () => {
    const user = userEvent.setup();
    const start = vi.fn(() => {
      throw new DOMException("Transition was skipped", "InvalidStateError");
    });
    setViewTransition(start);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderArchive();
    const row = document.getElementById("row-skg-coa")!;
    await user.click(within(row).getByRole("button", { name: /COA/ }));
    expect(start).toHaveBeenCalledTimes(1);
    expect(
      row.querySelector<HTMLElement>("[data-row-title]")!.style
        .viewTransitionName,
    ).toBe("");
    expect(last().openId).toBe("skg-coa");
    expect(window.location.search).toBe("?case=skg-coa");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("waits at most 200 ms for the panel title before the transition snapshots", async () => {
    const user = userEvent.setup();
    let update: (() => Promise<void>) | null = null;
    const done = Promise.resolve();
    setViewTransition(
      vi.fn((cb: () => Promise<void>) => {
        update = cb;
        return { ready: done, finished: done, updateCallbackDone: done };
      }),
    );
    renderArchive();
    const row = document.getElementById("row-skg-coa")!;
    await user.click(within(row).getByRole("button", { name: /COA/ }));
    expect(update).not.toBeNull();
    // The probe panel never renders a title, so the wait runs to its cap.
    const started = performance.now();
    await act(async () => {
      await update!();
    });
    const waited = performance.now() - started;
    expect(waited).toBeGreaterThanOrEqual(150);
    expect(waited).toBeLessThan(300);
  });

  it("keeps the whole list for a deep-linked project the filter hides until it has closed", async () => {
    window.history.replaceState(
      null,
      "",
      "/en/projects?kind=university&case=skg-coa",
    );
    renderArchive();
    await waitFor(() => expect(last().openId).toBe("skg-coa"));
    expect(last().items.map((i) => i.id)).toContain("skg-coa");
    act(() => last().onOpenChange(null));
    // Closing: the panel still finds the project, so it can play its close instead of vanishing.
    expect(last().openId).toBeNull();
    expect(last().items.map((i) => i.id)).toContain("skg-coa");
    expect(screen.getByRole("button", { name: /^University/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
