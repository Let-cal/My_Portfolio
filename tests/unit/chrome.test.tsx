import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// RoleProvider (used by the side rail) pulls in the routing helpers; a plain stub keeps the test free of the Next runtime.
const route = vi.hoisted(() => ({ pathname: "/en" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => route.pathname,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/en",
  getPathname: ({ locale }: { locale: string }) => `/${locale}`,
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { LanguageSwitch } from "@/components/site/LanguageSwitch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Header } from "@/components/site/Header";
import { HelloIntro } from "@/components/site/HelloIntro";
import { PillNav } from "@/components/site/PillNav";
import { ScrollProgressKoi } from "@/components/site/ScrollProgressKoi";
import { SectionLabel } from "@/components/site/SectionLabel";
import { SideRail } from "@/components/site/SideRail";
import { SoundToggle } from "@/components/site/SoundToggle";
import { SECTION_CHAPTERS, SECTION_IDS } from "@/components/site/sections";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi_ from "@/messages/vi.json";
import { ROLE_KEYS } from "@/content/schema";

type Entry = {
  isIntersecting: boolean;
  target: Element;
  boundingClientRect?: { top: number };
};
type Callback = (entries: Entry[]) => void;

/** IntersectionObserver stub: remembers the callback + options and lets a test fire entries by hand. */
const io = {
  callbacks: [] as Callback[],
  options: [] as (IntersectionObserverInit | undefined)[],
  fire(entries: Entry[]) {
    act(() => io.callbacks.forEach((cb) => cb(entries)));
  },
};

class FakeObserver {
  constructor(cb: Callback, opts?: IntersectionObserverInit) {
    io.callbacks.push(cb);
    io.options.push(opts);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function stubMedia(matches: (query: string) => boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

function withIntl(ui: ReactElement, locale: "en" | "ja" | "vi" = "en") {
  const messages = { en, ja, vi: vi_ }[locale];
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
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

const titles = Object.fromEntries(
  ROLE_KEYS.map((k) => [k, `Title ${k}`]),
) as Record<(typeof ROLE_KEYS)[number], string>;
const railProps = {
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

beforeEach(() => {
  route.pathname = "/en";
  io.callbacks = [];
  io.options = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.querySelectorAll("body > section").forEach((el) => el.remove());
});

describe("SideRail", () => {
  it("marks the section crossing the reading line with aria-current and a long accent line", () => {
    mountSections();
    render(withIntl(<SideRail {...railProps} />));
    const nav = screen.getByRole("navigation", { name: en.header.primaryNav });
    // The seven sections plus the all-projects page.
    expect(within(nav).getAllByRole("link")).toHaveLength(
      SECTION_IDS.length + 1,
    );
    expect(nav.querySelector("[aria-current]")).toBeNull();

    io.fire([
      { isIntersecting: true, target: document.getElementById("projects")! },
    ]);

    const active = within(nav).getByRole("link", { name: en.nav.projects });
    expect(active).toHaveAttribute("aria-current", "true");
    expect(nav.querySelectorAll("[aria-current]")).toHaveLength(1);
    expect(active.querySelector("span")).toHaveClass("w-16");
    const other = within(nav).getByRole("link", { name: en.nav.skills });
    expect(other.querySelector("span")).toHaveClass("w-8");
  });

  it("links to the all-projects page and marks it current there", () => {
    render(withIntl(<SideRail {...railProps} />));
    const nav = screen.getByRole("navigation", { name: en.header.primaryNav });
    const all = within(nav).getByRole("link", { name: en.archive.nav });
    expect(all).toHaveAttribute("href", "/en/projects");
    expect(all).not.toHaveAttribute("aria-current");
  });

  it("on the archive page, marks the all-projects link current and keeps section links in-page", () => {
    route.pathname = "/ja/projects";
    render(withIntl(<SideRail {...railProps} />, "ja"));
    const nav = screen.getByRole("navigation", { name: ja.header.primaryNav });
    expect(
      within(nav).getByRole("link", { name: ja.archive.nav }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: ja.archive.nav }),
    ).toHaveAttribute("href", "/ja/projects");
    // The archive page itself sends these to the home page (no routing code in the home bundle).
    expect(
      within(nav).getByRole("link", { name: ja.nav.skills }),
    ).toHaveAttribute("href", "#skills");
  });

  it("observes a thin band around the middle of the viewport", () => {
    mountSections();
    render(withIntl(<SideRail {...railProps} />));
    expect(io.options[0]?.rootMargin).toBe("-45% 0px -50% 0px");
  });

  it("names the home link with its visible text and points it at the hero", () => {
    render(withIntl(<SideRail {...railProps} />));
    const home = screen.getByRole("link", { name: "Le Tran Cat Lam" });
    expect(home).toHaveAttribute("href", "#hero");
    expect(home).not.toHaveAttribute("aria-label");
  });

  it("marks the last section active when scrolled to the bottom of the page", () => {
    mountSections();
    render(withIntl(<SideRail {...railProps} />));
    const nav = screen.getByRole("navigation", { name: en.header.primaryNav });
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(
      3000,
    );
    vi.stubGlobal("scrollY", 2200);
    vi.stubGlobal("innerHeight", 800);
    act(() => void window.dispatchEvent(new Event("scroll")));
    expect(
      within(nav).getByRole("link", { name: en.nav.contact }),
    ).toHaveAttribute("aria-current", "true");
    vi.restoreAllMocks();
  });

  it("shows the name, the title of the current role and the three contact links", () => {
    render(withIntl(<SideRail {...railProps} />));
    expect(screen.getByText("Le Tran Cat Lam")).toBeInTheDocument();
    // TextScramble renders the final text twice (screen reader copy + visual copy).
    expect(screen.getAllByText("Title fullstack").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/Let-cal",
    );
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/letcal",
    );
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      "mailto:letcal2003@gmail.com",
    );
  });
});

describe("PillNav", () => {
  it("has a link per section and moves aria-current with the active section", () => {
    mountSections();
    render(withIntl(<PillNav />));
    const nav = screen.getByRole("navigation", { name: en.header.primaryNav });
    expect(within(nav).getAllByRole("link")).toHaveLength(SECTION_IDS.length);
    io.fire([
      { isIntersecting: true, target: document.getElementById("skills")! },
    ]);
    expect(within(nav).getByRole("link", { name: /Skills/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    io.fire([
      { isIntersecting: true, target: document.getElementById("contact")! },
    ]);
    expect(within(nav).getByRole("link", { name: /Contact/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(nav.querySelectorAll("[aria-current]")).toHaveLength(1);
  });
});

describe("HelloIntro", () => {
  it("renders the first greeting, cycles through three languages, then removes itself and remembers it", () => {
    vi.useFakeTimers();
    const { container } = render(<HelloIntro />);
    const overlay = container.querySelector<HTMLElement>("[data-hello]")!;
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay).toHaveTextContent("Hello");
    act(() => void vi.advanceTimersByTime(350));
    expect(overlay).toHaveTextContent("こんにちは");
    act(() => void vi.advanceTimersByTime(350));
    expect(overlay).toHaveTextContent("Xin chào");
    expect(window.sessionStorage.getItem("hello")).toBeNull();
    act(() => void vi.advanceTimersByTime(350));
    expect(overlay.style.transform).toBe("translateY(-100%)");
    act(() => void vi.advanceTimersByTime(300));
    expect(container.querySelector("[data-hello]")).toBeNull();
    expect(window.sessionStorage.getItem("hello")).toBe("1");
  });

  it("takes 1.35s in total, inside the 1.4s budget", () => {
    vi.useFakeTimers();
    const { container } = render(<HelloIntro />);
    act(() => void vi.advanceTimersByTime(350));
    act(() => void vi.advanceTimersByTime(350));
    act(() => void vi.advanceTimersByTime(350));
    act(() => void vi.advanceTimersByTime(299));
    expect(container.querySelector("[data-hello]")).not.toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(container.querySelector("[data-hello]")).toBeNull();
  });

  it("does not render when this session already saw it", () => {
    window.sessionStorage.setItem("hello", "1");
    const { container } = render(<HelloIntro />);
    expect(container.querySelector("[data-hello]")).toBeNull();
  });

  it("does not render with reduced motion", () => {
    stubMedia((q) => q.includes("prefers-reduced-motion"));
    const { container } = render(<HelloIntro />);
    expect(container.querySelector("[data-hello]")).toBeNull();
  });

  it("is skipped by a click", async () => {
    const { container } = render(<HelloIntro />);
    fireEvent.click(container.querySelector("[data-hello]")!);
    expect(container.querySelector("[data-hello]")).toBeNull();
    expect(window.sessionStorage.getItem("hello")).toBe("1");
  });

  it("is skipped by any key", () => {
    const { container } = render(<HelloIntro />);
    fireEvent.keyDown(window, { key: "a" });
    expect(container.querySelector("[data-hello]")).toBeNull();
  });
});

describe("SoundToggle", () => {
  it("flips aria-pressed and stores the choice", async () => {
    const user = userEvent.setup();
    render(withIntl(<SoundToggle />));
    const button = screen.getByRole("button", { name: en.sound.label });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("sound")).toBe("on");
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(window.localStorage.getItem("sound")).toBe("off");
  });
});

describe("SectionLabel", () => {
  it("renders the numbered title and the vertical chapter label", () => {
    render(<SectionLabel index="01" title="Experience" kanji="第一章 経歴" />);
    expect(screen.getByText("01 — Experience")).toBeInTheDocument();
    const vertical = screen.getByText("第一章 経歴");
    expect(vertical).toHaveAttribute("aria-hidden", "true");
    expect(vertical.style.writingMode).toBe("vertical-rl");
    expect(vertical.style.opacity).toBe("0.35");
  });

  it("shows only the kanji for chapter 00 and hides the decorative eyebrow from assistive tech", () => {
    const { container } = render(
      <SectionLabel index="00" title="Home" kanji="序章" />,
    );
    expect(screen.getByText("序章")).toBeInTheDocument();
    expect(container.textContent).not.toContain("00");
    render(<SectionLabel index="01" title="Experience" kanji="第一章 経歴" />);
    const eyebrow = screen.getByText("01 — Experience");
    expect(eyebrow).toHaveAttribute("aria-hidden", "true");
    expect(eyebrow).toHaveClass("pointer-events-none");
  });
});

describe("SECTION_CHAPTERS", () => {
  it("pins the seven chapter labels of spec 13.3 E3", () => {
    expect(
      Object.fromEntries(
        SECTION_IDS.map((id) => [
          id,
          [SECTION_CHAPTERS[id].index, SECTION_CHAPTERS[id].kanji],
        ]),
      ),
    ).toEqual({
      hero: ["00", "序章"],
      experience: ["01", "第一章 経歴"],
      projects: ["02", "第二章 作品"],
      skills: ["03", "第三章 技術"],
      certificates: ["04", "第四章 資格"],
      why: ["05", "第五章 昇龍"],
      contact: ["06", "終章 連絡"],
    });
  });
});

describe("Header", () => {
  const urls = { fullstack: "/cv/a.pdf", techlead: "/cv/b.pdf", pm: "" };
  it("shows the CV download of the current role and hides it when the URL is empty", () => {
    const { rerender } = render(withIntl(<Header cvUrls={urls} />));
    expect(
      screen.getByRole("link", { name: en.hero.downloadCv }),
    ).toHaveAttribute("href", "/cv/a.pdf");
    rerender(withIntl(<Header cvUrls={{ ...urls, fullstack: "" }} />));
    expect(screen.queryByRole("link", { name: en.hero.downloadCv })).toBeNull();
  });
});

describe("ScrollProgressKoi", () => {
  it("shows the koi icon and swaps to the dragon once #why is in view", () => {
    mountSections();
    const { container } = render(<ScrollProgressKoi />);
    expect(container.querySelector("[data-icon='koi']")).not.toBeNull();
    expect(container.querySelector("[data-icon='dragon']")).toBeNull();
    io.fire([
      { isIntersecting: true, target: document.getElementById("why")! },
    ]);
    expect(container.querySelector("[data-icon='dragon']")).not.toBeNull();
    expect(container.querySelector("[data-icon='koi']")).toBeNull();
  });

  it("is hidden from assistive tech and does not take clicks", () => {
    const { container } = render(<ScrollProgressKoi />);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveClass("pointer-events-none");
  });
});

describe("LanguageSwitch", () => {
  it("names each button with the language and its visible code", () => {
    render(withIntl(<LanguageSwitch />));
    expect(
      screen.getByRole("button", { name: "EN · English" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "JA · 日本語" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "VI · Tiếng Việt" }),
    ).toBeInTheDocument();
  });
});

describe("SheetContent", () => {
  it("uses the given label for the close button", () => {
    render(
      <Sheet open>
        <SheetContent closeLabel="閉じる">
          <SheetTitle>t</SheetTitle>
          <SheetDescription>d</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
  });
});

describe("messages", () => {
  it("has a sound label and a short pill label for every section in each language", () => {
    for (const messages of [en, ja, vi_]) {
      expect(messages.sound.label).toBeTruthy();
      for (const id of SECTION_IDS) expect(messages.pill[id]).toBeTruthy();
    }
  });
});
