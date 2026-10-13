import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { replace, gsapTicker, scrollTriggerUpdate, lenisInstances } = vi.hoisted(() => ({
  replace: vi.fn(),
  gsapTicker: { add: vi.fn(), remove: vi.fn(), lagSmoothing: vi.fn() },
  scrollTriggerUpdate: vi.fn(),
  lenisInstances: [] as { options: Record<string, unknown>; scrollTo: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }[],
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/en",
  getPathname: ({ locale }: { locale: string }) => `/${locale}`,
}));
vi.mock("gsap", () => ({ default: { ticker: gsapTicker, registerPlugin: vi.fn() }, gsap: { ticker: gsapTicker, registerPlugin: vi.fn() } }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { update: scrollTriggerUpdate } }));
vi.mock("lenis", () => ({
  default: class FakeLenis {
    options: Record<string, unknown>;
    scrollTo = vi.fn();
    raf = vi.fn();
    on = vi.fn();
    off = vi.fn();
    stop = vi.fn();
    start = vi.fn();
    destroy = vi.fn();
    constructor(options: Record<string, unknown>) {
      this.options = options;
      lenisInstances.push(this);
    }
  },
}));

import { CommandPalette } from "@/components/site/CommandPalette";
import { MotionProvider } from "@/components/site/MotionProvider";
import { Reveal } from "@/components/site/Reveal";
import { RoleProvider } from "@/components/site/RoleProvider";
import { SmoothScroll } from "@/components/site/SmoothScroll";
import { setMotionPreference } from "@/components/site/motion-preference";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";

const html = document.documentElement;

/** jsdom has none of these; cmdk needs ResizeObserver and scrollIntoView, motion's whileInView needs IntersectionObserver. */
class FakeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const assign = vi.fn();
const CV = { fullstack: "https://cv.test/fs.pdf", techlead: "https://cv.test/tl.pdf", pm: "https://cv.test/pm.pdf" };

function stubOs(osReduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: osReduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

function withIntl(ui: ReactElement, locale: "en" | "ja" = "en") {
  return (
    <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : en}>
      {ui}
    </NextIntlClientProvider>
  );
}

function palette(locale: "en" | "ja" = "en", extra?: ReactElement) {
  return withIntl(
    <RoleProvider>
      {extra}
      <CommandPalette cvUrls={CV} email="me@example.com" />
    </RoleProvider>,
    locale,
  );
}

function openPalette() {
  act(() => {
    window.dispatchEvent(new Event("open-command"));
  });
}

/** Elements the tests add to <body> by hand (React-owned portals must not be wiped). */
const mounted: Element[] = [];
function mount<T extends Element>(el: T): T {
  document.body.append(el);
  mounted.push(el);
  return el;
}

/** A section with a heading, like the page's sections. */
function mountSection(id: string, scrollMargin = "") {
  const section = document.createElement("section");
  section.id = id;
  if (scrollMargin) section.style.scrollMarginTop = scrollMargin;
  const heading = document.createElement("h2");
  heading.id = `${id}-heading`;
  section.append(heading);
  mount(section);
  return { section, heading };
}

// CommandPalette loads its dialog chunk on first use; import it up front so a cold transform cannot eat a test's wait.
beforeAll(async () => {
  await import("@/components/site/CommandPaletteDialog");
}, 30_000);

beforeEach(() => {
  localStorage.clear();
  html.removeAttribute("data-motion");
  html.classList.remove("light");
  html.classList.add("dark");
  replace.mockClear();
  assign.mockClear();
  lenisInstances.length = 0;
  gsapTicker.add.mockClear();
  gsapTicker.remove.mockClear();
  stubOs(false);
  vi.stubGlobal("ResizeObserver", FakeObserver);
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign, search: "?role=pm", hash: "#skills" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  mounted.splice(0).forEach((el) => el.remove());
});

describe("CommandPalette", () => {
  it("is closed until Ctrl+K opens it, and Esc closes it", async () => {
    render(palette());
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens with Meta+K (which toggles it) and with the open-command event", async () => {
    render(palette());
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    openPalette();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("lists the six labelled groups with all their commands", async () => {
    render(palette());
    openPalette();
    const dialog = await screen.findByRole("dialog");
    for (const name of ["Go to", "Role", "Language", "Theme", "Motion", "Actions"]) {
      expect(within(dialog).getByRole("group", { name })).toBeInTheDocument();
    }
    expect(within(dialog).getAllByRole("option")).toHaveLength(7 + 3 + 3 + 2 + 3 + 3);
    expect(within(dialog).getByRole("combobox")).toHaveAccessibleName("Search commands");
  });

  it("filters the commands while typing", async () => {
    const user = userEvent.setup();
    render(palette());
    openPalette();
    await user.type(await screen.findByRole("combobox"), "proj");
    expect(screen.getByRole("option", { name: "Projects" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Experience" })).toBeNull();
  });

  it("selecting 日本語 does a full page load to /ja keeping ?role and the hash", async () => {
    const user = userEvent.setup();
    render(palette());
    openPalette();
    await user.click(await screen.findByRole("option", { name: "日本語" }));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign.mock.calls[0][0]).toBe("/ja?role=pm#skills");
    expect(replace).not.toHaveBeenCalled();
  });

  it("selecting the current language does nothing", async () => {
    const user = userEvent.setup();
    render(palette());
    openPalette();
    await user.click(await screen.findByRole("option", { name: "English" }));
    expect(assign).not.toHaveBeenCalled();
  });

  it("switches the role through the role provider and closes", async () => {
    const user = userEvent.setup();
    render(palette());
    openPalette();
    await user.click(await screen.findByRole("option", { name: "Tech Lead" }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("role=techlead"), { scroll: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("switches the theme", async () => {
    const user = userEvent.setup();
    render(palette());
    openPalette();
    await user.click(await screen.findByRole("option", { name: "Theme: Light" }));
    expect(html.classList.contains("light")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("sets the motion preference", async () => {
    const user = userEvent.setup();
    render(palette());
    openPalette();
    await user.click(await screen.findByRole("option", { name: "Motion: Off" }));
    expect(localStorage.getItem("motion")).toBe("off");
    expect(html.dataset.motion).toBe("reduced");
  });

  it("pauses Lenis while open, resumes it on close, and never restarts one that Motion: Off just destroyed", async () => {
    const user = userEvent.setup();
    render(palette("en", <SmoothScroll />));
    await waitFor(() => expect(lenisInstances).toHaveLength(1));
    const lenis = lenisInstances[0];
    openPalette();
    await screen.findByRole("dialog");
    expect(lenis.stop).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    await waitFor(() => expect(lenis.start).toHaveBeenCalledTimes(1));

    openPalette();
    await user.click(await screen.findByRole("option", { name: "Motion: Off" }));
    await waitFor(() => expect(lenis.destroy).toHaveBeenCalledTimes(1));
    expect(lenis.start).toHaveBeenCalledTimes(1);
  });

  it("opens the 60-second view for the current role", async () => {
    const user = userEvent.setup();
    render(palette());
    openPalette();
    await user.click(await screen.findByRole("option", { name: "60-second view" }));
    expect(assign).toHaveBeenCalledWith("/en/quick?role=fullstack");
  });

  it("go-to closes the palette, scrolls through Lenis when it is active and focuses the section heading", async () => {
    const user = userEvent.setup();
    const { section, heading } = mountSection("projects", "56px");
    render(palette("en", <SmoothScroll />));
    await waitFor(() => expect(lenisInstances).toHaveLength(1));
    openPalette();
    await user.click(await screen.findByRole("option", { name: "Projects" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(lenisInstances[0].scrollTo).toHaveBeenCalledWith(section, expect.anything()));
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("go-to falls back to scrollIntoView when Lenis is not active", async () => {
    const user = userEvent.setup();
    const { section, heading } = mountSection("contact");
    section.scrollIntoView = vi.fn();
    render(palette());
    openPalette();
    await user.click(await screen.findByRole("option", { name: "Contact" }));
    await waitFor(() => expect(section.scrollIntoView).toHaveBeenCalled());
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("copies the email and downloads the CV of the current role", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(palette());
    openPalette();
    await user.click(await screen.findByRole("option", { name: "Copy email" }));
    expect(writeText).toHaveBeenCalledWith("me@example.com");
    openPalette();
    await user.click(await screen.findByRole("option", { name: "Download CV" }));
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it("has Japanese labels", async () => {
    render(palette("ja"));
    openPalette();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("group", { name: ja.command.groups.goTo })).toBeInTheDocument();
  });
});

describe("SmoothScroll", () => {
  it("starts Lenis tied to gsap.ticker and ScrollTrigger", async () => {
    render(<SmoothScroll />);
    await waitFor(() => expect(lenisInstances).toHaveLength(1));
    expect(lenisInstances[0].options.autoRaf).toBe(false);
    // The Motion toggle (not Lenis's own OS check) decides, and nested scrollers keep their wheel.
    expect(lenisInstances[0].options).toMatchObject({ respectReducedMotion: false, allowNestedScroll: true });
    expect(gsapTicker.add).toHaveBeenCalledTimes(1);
    expect(lenisInstances[0].on).toHaveBeenCalledWith("scroll", scrollTriggerUpdate);
  });

  it("does not start under reduced motion", async () => {
    stubOs(true);
    render(<SmoothScroll />);
    // Give the (skipped) dynamic imports a chance to land before asserting that nothing started.
    await new Promise((r) => setTimeout(r, 50));
    expect(lenisInstances).toHaveLength(0);
  });

  it("starts when the OS reduces motion but the Motion toggle says on", async () => {
    stubOs(true);
    setMotionPreference("on");
    render(<SmoothScroll />);
    await waitFor(() => expect(lenisInstances).toHaveLength(1));
  });

  it("follows the preference live and cleans up on unmount", async () => {
    const { unmount } = render(<SmoothScroll />);
    await waitFor(() => expect(lenisInstances).toHaveLength(1));
    act(() => setMotionPreference("off"));
    expect(lenisInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(gsapTicker.remove).toHaveBeenCalledTimes(1);
    act(() => setMotionPreference("on"));
    await waitFor(() => expect(lenisInstances).toHaveLength(2));
    unmount();
    expect(lenisInstances[1].destroy).toHaveBeenCalledTimes(1);
  });

  it("scrolls in-page #anchor links through Lenis", async () => {
    const { section } = mountSection("skills", "56px");
    const link = document.createElement("a");
    link.setAttribute("href", "#skills");
    mount(link);
    render(<SmoothScroll />);
    await waitFor(() => expect(lenisInstances).toHaveLength(1));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(lenisInstances[0].scrollTo).toHaveBeenCalledWith(section, expect.anything());
  });

  it("corrects a landing that missed because the page shifted while scrolling", async () => {
    const { section } = mountSection("skills", "56px");
    section.getBoundingClientRect = () => ({ top: 90 }) as DOMRect;
    const link = document.createElement("a");
    link.setAttribute("href", "#skills");
    mount(link);
    render(<SmoothScroll />);
    await waitFor(() => expect(lenisInstances).toHaveLength(1));
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const { scrollTo } = lenisInstances[0];
    scrollTo.mock.calls[0][1].onComplete();
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith(section, { duration: 0.4 });
    // Within 2px of the scroll margin there is nothing to correct.
    section.getBoundingClientRect = () => ({ top: 57 }) as DOMRect;
    scrollTo.mock.calls[0][1].onComplete();
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("ignores a link whose hash is a malformed escape instead of throwing", async () => {
    const link = document.createElement("a");
    link.setAttribute("href", "#%E0%A4%A");
    mount(link);
    render(<SmoothScroll />);
    await waitFor(() => expect(lenisInstances).toHaveLength(1));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    expect(() => link.dispatchEvent(click)).not.toThrow();
    expect(lenisInstances[0].scrollTo).not.toHaveBeenCalled();
  });

  it("leaves modified clicks and other links alone", async () => {
    mountSection("skills");
    const link = document.createElement("a");
    link.setAttribute("href", "#skills");
    const other = document.createElement("a");
    other.setAttribute("href", "/elsewhere");
    mount(link);
    mount(other);
    render(<SmoothScroll />);
    await waitFor(() => expect(lenisInstances).toHaveLength(1));
    const modified = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    link.dispatchEvent(modified);
    // Read the flag once the event has bubbled past SmoothScroll, then cancel it so jsdom does not try to navigate.
    let plainWasPrevented: boolean | undefined;
    window.addEventListener(
      "click",
      (e) => {
        plainWasPrevented = e.defaultPrevented;
        e.preventDefault();
      },
      { once: true },
    );
    other.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(modified.defaultPrevented).toBe(false);
    expect(plainWasPrevented).toBe(false);
    expect(lenisInstances[0].scrollTo).not.toHaveBeenCalled();
  });
});

describe("Reveal", () => {
  it("wraps its children in an element that starts hidden", () => {
    render(
      <MotionProvider>
        <Reveal className="x">
          <h2>Hello</h2>
        </Reveal>
      </MotionProvider>,
    );
    const wrapper = screen.getByRole("heading", { name: "Hello" }).parentElement!;
    expect(wrapper).toHaveAttribute("data-reveal");
    expect(wrapper).toHaveClass("x");
    expect(wrapper.style.opacity).toBe("0");
  });

  it("is a plain static wrapper under reduced motion", () => {
    stubOs(true);
    render(
      <MotionProvider>
        <Reveal>
          <h2>Hello</h2>
        </Reveal>
      </MotionProvider>,
    );
    const wrapper = screen.getByRole("heading", { name: "Hello" }).parentElement!;
    expect(wrapper.style.opacity).toBe("");
    expect(wrapper.style.transform).toBe("");
  });
});
