import { act, cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/en" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => route.pathname,
}));

import { SideRail } from "@/components/site/SideRail";
import { SECTION_CHAPTERS, SECTION_IDS } from "@/components/site/sections";
import { ROLE_KEYS } from "@/content/schema";
import en from "@/messages/en.json";

type Entry = { isIntersecting: boolean; target: Element };

const io = {
  callbacks: [] as ((entries: Entry[]) => void)[],
  fire(entries: Entry[]) {
    act(() => io.callbacks.forEach((cb) => cb(entries)));
  },
};
class FakeIntersectionObserver {
  constructor(cb: (entries: Entry[]) => void) {
    io.callbacks.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ro = {
  callbacks: [] as ResizeObserverCallback[],
  observed: [] as Element[],
  fire() {
    act(() =>
      ro.callbacks.forEach((cb) => cb([], {} as unknown as ResizeObserver)),
    );
  },
};
class FakeResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    ro.callbacks.push(cb);
  }
  observe(el: Element) {
    ro.observed.push(el);
  }
  unobserve() {}
  disconnect() {}
}

const titles = Object.fromEntries(
  ROLE_KEYS.map((k) => [k, `Title ${k}`]),
) as Record<(typeof ROLE_KEYS)[number], string>;
const props = {
  icons: {
    github: <svg aria-hidden="true" />,
    linkedin: <svg aria-hidden="true" />,
  },
  name: "Le Tran Cat Lam",
  titles,
  links: {
    github: "https://github.com/Let-cal",
    linkedin: "https://www.linkedin.com/in/letcal",
    email: "letcal2003@gmail.com",
  },
};

function withIntl(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>
  );
}

function mountSections() {
  for (const id of SECTION_IDS) {
    const el = document.createElement("section");
    el.id = id;
    document.body.append(el);
  }
}

/** Places every numeral at a fixed y (relative to the list, which sits at the top of the page). */
function placeNumerals(nav: HTMLElement, step: number) {
  nav.querySelectorAll<HTMLElement>("[data-numeral]").forEach((el, i) => {
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      top: 10 + i * step,
      height: 20,
      bottom: 30 + i * step,
      left: 0,
      right: 20,
      width: 20,
      x: 0,
      y: 10 + i * step,
      toJSON: () => ({}),
    });
  });
}

beforeEach(() => {
  route.pathname = "/en";
  io.callbacks = [];
  ro.callbacks = [];
  ro.observed = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  // The thread engine loads when the browser is idle; run that at once.
  idle.mockClear();
  vi.stubGlobal("requestIdleCallback", idle);
});

const idle = vi.fn((cb: () => void) => {
  cb();
  return 1;
});

/** Renders the rail over mounted sections, waits for the engine and draws the thread once. */
async function drawnRail() {
  mountSections();
  const view = render(withIntl(<SideRail {...props} />));
  const nav = screen.getByRole("navigation", { name: en.header.primaryNav });
  const height = vi
    .spyOn(HTMLElement.prototype, "offsetHeight", "get")
    .mockReturnValue(400);
  placeNumerals(nav, 40);
  await vi.waitFor(() => expect(ro.observed.length).toBeGreaterThan(0));
  ro.fire();
  const root = nav.querySelector<HTMLElement>("[data-ink-root]")!;
  return { view, nav, root, height };
}

const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

afterEach(() => {
  // Unmount first: a cached engine chunk would otherwise attach after the stubs below are gone.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.querySelectorAll("body > section").forEach((el) => el.remove());
});

describe("SideRail ink thread", () => {
  it("loads the thread engine when idle, within 2 s at the latest", async () => {
    await drawnRail();
    expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
  });

  it("forgets the numeral positions while the rail is hidden, so a scroll draws nothing stale", async () => {
    const { root, height } = await drawnRail();
    const drop = root.querySelector<HTMLElement>("[data-ink-drop]")!;
    // The window narrows below 1024 px: the rail is display:none and measures 0 high.
    height.mockReturnValue(0);
    ro.fire();
    drop.style.transform = "";
    root.removeAttribute("data-inked");
    io.fire([
      { isIntersecting: true, target: document.getElementById("projects")! },
    ]);
    window.dispatchEvent(new Event("scroll"));
    await frame();
    await frame();
    expect(drop.style.transform).toBe("");
    expect(root).not.toHaveAttribute("data-inked");
  });

  it("does not measure after it stopped, even when the fonts finish later", async () => {
    let ready!: () => void;
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: new Promise<void>((resolve) => (ready = resolve)) },
    });
    try {
      mountSections();
      const view = render(withIntl(<SideRail {...props} />));
      const nav = screen.getByRole("navigation", {
        name: en.header.primaryNav,
      });
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
        400,
      );
      await vi.waitFor(() => expect(ro.observed.length).toBeGreaterThan(0));
      const root = nav.querySelector<HTMLElement>("[data-ink-root]")!;
      view.unmount();
      ready();
      await Promise.resolve();
      await Promise.resolve();
      expect(root).not.toHaveAttribute("data-ink-ready");
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  it("Esc hides the peek card until the pointer or focus moves to another chapter (WCAG 1.4.13)", async () => {
    const { nav, root } = await drawnRail();
    const link = (id: string) =>
      nav.querySelector<HTMLElement>(`a[data-chapter="${id}"]`)!;
    act(() => {
      link("projects").dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true }),
      );
    });
    expect(root).not.toHaveAttribute("data-peek-off");
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(root).toHaveAttribute("data-peek-off");
    // Still on the same chapter: stays dismissed.
    act(() => {
      link("projects").dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true }),
      );
    });
    expect(root).toHaveAttribute("data-peek-off");
    // Another chapter shows its peek again.
    act(() => {
      link("skills").focus();
    });
    expect(root).not.toHaveAttribute("data-peek-off");
  });

  it("gives the thread's gradient an id of its own and strokes with it", async () => {
    render(
      withIntl(
        <>
          <SideRail {...props} />
          <SideRail {...props} />
        </>,
      ),
    );
    const gradients = [...document.querySelectorAll("[data-ink-gradient]")].map(
      (g) => g.id,
    );
    expect(gradients).toHaveLength(2);
    expect(new Set(gradients).size).toBe(2);
    const strokes = [...document.querySelectorAll("[data-ink] path")].map((p) =>
      p.getAttribute("stroke"),
    );
    expect(strokes).toEqual(gradients.map((id) => `url(#${id})`));
    // Let both engines attach before the stubs go.
    await vi.waitFor(() => expect(ro.observed).toHaveLength(2));
  });

  it("renders numerals hidden from assistive tech", () => {
    render(withIntl(<SideRail {...props} />));
    const nav = screen.getByRole("navigation", { name: en.header.primaryNav });
    for (const id of SECTION_IDS) {
      const link = within(nav).getByRole("link", { name: en.nav[id] });
      const numeral = link.querySelector("[data-numeral]")!;
      expect(numeral).toHaveTextContent(SECTION_CHAPTERS[id].numeral);
      expect(numeral).toHaveAttribute("aria-hidden", "true");
      expect(numeral).toHaveAttribute("lang", "ja");
      // The peek card is decorative: chapter kanji plus a one-line hint, hidden from assistive tech.
      const peek = link.querySelector("[data-peek]")!;
      expect(peek).toHaveAttribute("aria-hidden", "true");
      expect(peek).toHaveTextContent(SECTION_CHAPTERS[id].kanji);
      expect(peek).toHaveTextContent(en.nav.peek[id]);
      expect(link.querySelector("[data-progress]")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
    expect(["序", "一", "二", "三", "四", "五", "終"]).toEqual(
      SECTION_IDS.map((id) => SECTION_CHAPTERS[id].numeral),
    );
    // The spur's arrow is decorative too, so the link keeps its plain name.
    expect(
      within(nav).getByRole("link", { name: en.archive.nav }),
    ).toHaveTextContent("↗");
  });

  it("keeps aria-current on the active section", () => {
    mountSections();
    render(withIntl(<SideRail {...props} />));
    const nav = screen.getByRole("navigation", { name: en.header.primaryNav });
    expect(nav.querySelector("[aria-current]")).toBeNull();

    io.fire([
      { isIntersecting: true, target: document.getElementById("projects")! },
    ]);
    expect(
      within(nav).getByRole("link", { name: en.nav.projects }),
    ).toHaveAttribute("aria-current", "true");
    expect(nav.querySelectorAll("[aria-current]")).toHaveLength(1);

    io.fire([
      { isIntersecting: true, target: document.getElementById("why")! },
    ]);
    expect(within(nav).getByRole("link", { name: en.nav.why })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(nav.querySelectorAll("[aria-current]")).toHaveLength(1);
  });

  it("rebuilds the path on resize", async () => {
    mountSections();
    render(withIntl(<SideRail {...props} />));
    const nav = screen.getByRole("navigation", { name: en.header.primaryNav });
    const path = () =>
      nav.querySelector("[data-ink-path]")!.getAttribute("d") ?? "";

    // jsdom has no layout: give the list a height and the numerals their places.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(400);
    placeNumerals(nav, 40);
    // The engine is a separate chunk: wait until it has observed the list and drawn the thread.
    await vi.waitFor(() => expect(ro.observed.length).toBeGreaterThan(0));
    ro.fire();
    expect(path()).toMatch(/^M\d+(\.\d+)? 20\b/);
    expect(path()).toContain(` ${20 + 6 * 40}`);

    placeNumerals(nav, 50);
    ro.fire();
    expect(path()).toContain(` ${20 + 6 * 50}`);
    expect(path()).not.toContain(` ${20 + 6 * 40}`);
    // Base and accent strokes share the one path.
    const ds = [...nav.querySelectorAll("[data-ink-path]")].map((p) =>
      p.getAttribute("d"),
    );
    expect(new Set(ds).size).toBe(1);
  });
});
