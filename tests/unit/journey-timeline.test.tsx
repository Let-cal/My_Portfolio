import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import seed from "@/content/seed.json";
import { contentSchema } from "@/content/schema";
import { JourneyTimeline } from "@/components/sections/experience/JourneyTimeline";
import { JourneyTree } from "@/components/sections/experience/JourneyTree";
import { RoleProvider } from "@/components/site/RoleProvider";
import { buildJourney, type JourneyParent } from "@/lib/journey";
import { stubIntersectionObserver } from "../helpers/io-stub";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

const t = (key: string) => key;
const journey = () =>
  buildJourney(contentSchema.parse(seed), "en", t, new Date(2026, 9, 30));
const skg = () => journey().find((p) => p.anchor === "exp-skg-software")!;

const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {node}
  </NextIntlClientProvider>
);

/** jsdom has no layout: give every Gantt label and stint segment the box a browser would. */
function stubLayout(box: {
  lane: number;
  label: (title: string) => { left: number; width: number };
  seg: (label: string) => { scroll: number; client: number };
}) {
  const own = <T,>(el: Element, cls: string, fn: (el: Element) => T) =>
    el.classList.contains(cls) ? fn(el) : undefined;
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
    function (this: HTMLElement) {
      return (
        own(this, "jt-blabel", (el) => box.label(el.textContent!).left) ?? 0
      );
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return (
        own(this, "jt-blabel", (el) => box.label(el.textContent!).width) ?? 0
      );
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return (
        own(this, "jt-lane", () => box.lane) ??
        own(this, "jt-seg", (el) => box.seg(el.textContent!).client) ??
        0
      );
    },
  );
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return own(this, "jt-seg", (el) => box.seg(el.textContent!).scroll) ?? 0;
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (document as { fonts?: unknown }).fonts;
});

describe("JourneyTimeline labels", () => {
  it("hides only the labels that do not fit; the fitting ones stay painted", () => {
    stubLayout({
      lane: 600,
      // "AI Agent" would run past the Gantt's right edge; every other name fits.
      label: (title) =>
        title === "AI Agent"
          ? { left: 560, width: 80 }
          : { left: 100, width: 90 },
      // "Intern" is wider than its short segment; "Software Engineer" fits.
      seg: (label) =>
        label === "Intern"
          ? { scroll: 60, client: 40 }
          : { scroll: 120, client: 400 },
    });
    render(wrap(<JourneyTimeline parent={skg()} />));
    const gantt = screen.getByRole("img");
    const label = (title: string) =>
      [...gantt.querySelectorAll(".jt-blabel")].find(
        (n) => n.textContent === title,
      )!;
    const seg = (text: string) =>
      [...gantt.querySelectorAll(".jt-seg")].find(
        (n) => n.textContent === text,
      )!;
    expect(label("AI Agent")).toHaveAttribute("data-clip");
    for (const title of [
      "COA (Certificate of Analysis system)",
      "FlexyBox Phase 2",
      "FlexyBox Phase 1",
      "TONGUE-AI & Driver MS",
    ])
      expect(label(title)).not.toHaveAttribute("data-clip");
    expect(seg("Intern")).toHaveAttribute("data-clip");
    expect(seg("Software Engineer")).not.toHaveAttribute("data-clip");
  });

  it("hides a clipped stint label with visibility, which forced colours cannot repaint", () => {
    render(wrap(<JourneyTimeline parent={skg()} />));
    const seg = screen.getByRole("img").querySelector(".jt-seg")!;
    // The text sits in its own box, so it can be hidden while the segment stays drawn.
    expect(seg.firstElementChild?.tagName).toBe("SPAN");
    expect(seg.firstElementChild).toHaveTextContent(seg.textContent!);
    const css = readFileSync(
      "src/components/sections/experience/journey.css",
      "utf8",
    );
    expect(css).toMatch(
      /\.jt-seg\[data-clip\] > span \{\s*visibility: hidden;/,
    );
    expect(css).not.toMatch(/\.jt-seg\[data-clip\] \{\s*color: transparent;/);
  });

  it("does not measure a Gantt that unmounted before the fonts were ready", async () => {
    let ready!: () => void;
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: new Promise<void>((resolve) => (ready = resolve)) },
    });
    const view = render(wrap(<JourneyTimeline parent={skg()} />));
    const gantt = screen.getByRole("img");
    view.unmount();
    const measured = vi.spyOn(gantt, "querySelectorAll");
    ready();
    await Promise.resolve();
    await Promise.resolve();
    expect(measured).not.toHaveBeenCalled();
  });
});

describe("JourneyTree guard stint", () => {
  it("rows of the stint-less group keep a heading level under the parent (h4, not h5)", async () => {
    stubIntersectionObserver();
    const parents: JourneyParent[] = journey().map((p) => {
      if (p.anchor !== "exp-skg-software") return p;
      // A project whose stint is not shown lands in the guard stint (id "").
      const [moved, ...rest] = p.stints[1].children;
      return {
        ...p,
        stints: [
          p.stints[0],
          { ...p.stints[1], children: rest },
          {
            ...p.stints[1],
            id: "",
            title: "",
            promotedFrom: null,
            children: [moved],
          },
        ],
      };
    });
    render(
      wrap(
        <RoleProvider>
          <JourneyTree parents={parents} />
        </RoleProvider>,
      ),
    );
    const row = document.getElementById("tree-skg-flexybox-p1")!;
    expect(
      within(row).getByRole("heading", {
        name: "FlexyBox Phase 1",
        hidden: true,
      }).tagName,
    ).toBe("H4");
    // Rows under a stint heading (h4) stay h5.
    expect(
      within(document.getElementById("tree-skg-coa")!).getByRole("heading", {
        name: "COA (Certificate of Analysis system)",
        hidden: true,
      }).tagName,
    ).toBe("H5");
  });
});
