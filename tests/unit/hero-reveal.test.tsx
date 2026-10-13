import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import seed from "@/content/seed.json";
import { contentSchema, type Content } from "@/content/schema";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/en",
}));
vi.mock("next/image", () => ({
  default: ({ preload, fill, ...props }: Record<string, unknown>) => {
    void preload;
    void fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...(props as object)} alt={String(props.alt)} />;
  },
}));

import { HeroStats } from "@/components/sections/hero/HeroStats";
import { NameMarquee } from "@/components/sections/hero/NameMarquee";
import { ProfileStatusCard } from "@/components/sections/hero/ProfileStatusCard";
import { QuickFacts } from "@/components/sections/hero/QuickFacts";
import { RolePanels } from "@/components/sections/hero/RolePanels";
import { RoleStage } from "@/components/sections/hero/RoleStage";
import { RoleWheel } from "@/components/sections/hero/RoleWheel";
import { RotatingPhrase } from "@/components/sections/hero/RotatingPhrase";
import { RoleProvider } from "@/components/site/RoleProvider";

const content: Content = contentSchema.parse(seed);

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
const reduced = (q: string) => q.includes("prefers-reduced-motion");

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RoleProvider>{ui}</RoleProvider>
    </NextIntlClientProvider>,
  );
}

const baseImage = (container: HTMLElement) => container.querySelector<HTMLImageElement>("[data-layer='base'] img");

beforeEach(() => {
  replace.mockClear();
  window.history.replaceState(null, "", "/en");
  document.documentElement.style.removeProperty("--role-accent");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("RoleWheel", () => {
  it("is a labelled radiogroup with one radio per role, named after the arc labels", () => {
    wrap(<RoleWheel />);
    const group = screen.getByRole("radiogroup", { name: en.hero.wheel.label });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["DEVELOPER", "TECH LEAD", "TECHNICAL PM"]);
    expect(screen.getByRole("radio", { name: "DEVELOPER" })).toHaveAttribute("aria-checked", "true");
  });

  it("uses a roving tabindex and moves to the next role with ArrowRight", async () => {
    wrap(<RoleWheel />);
    const dev = screen.getByRole("radio", { name: "DEVELOPER" });
    expect(dev).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "TECH LEAD" })).toHaveAttribute("tabindex", "-1");
    act(() => dev.focus());
    await userEvent.keyboard("{ArrowRight}");
    const tl = screen.getByRole("radio", { name: "TECH LEAD" });
    expect(tl).toHaveAttribute("aria-checked", "true");
    expect(tl).toHaveAttribute("tabindex", "0");
    expect(dev).toHaveAttribute("aria-checked", "false");
    expect(tl).toHaveFocus();
    expect(replace).toHaveBeenCalledWith("/en?role=techlead", { scroll: false });
  });

  it("ArrowLeft from the first role wraps to the last", async () => {
    wrap(<RoleWheel />);
    act(() => screen.getByRole("radio", { name: "DEVELOPER" }).focus());
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "TECHNICAL PM" })).toHaveAttribute("aria-checked", "true");
  });

  it("Enter on the PM radio picks pm: accent on <html> and, after the sweep, the pm base image", async () => {
    const { container } = wrap(<RoleWheel />);
    expect(baseImage(container)?.getAttribute("src")).toContain("role-developer");
    act(() => screen.getByRole("radio", { name: "TECHNICAL PM" }).focus());
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("radio", { name: "TECHNICAL PM" })).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.style.getPropertyValue("--role-accent")).toBe("#e0a84e");
    await waitFor(() => expect(baseImage(container)?.getAttribute("src")).toContain("role-pm"), { timeout: 2000 });
  });

  it("swaps the base image at once under reduced motion (no sweep timer)", () => {
    stubMedia(reduced);
    const { container } = wrap(<RoleWheel />);
    fireEvent.click(screen.getByRole("radio", { name: "TECHNICAL PM" }));
    expect(baseImage(container)?.getAttribute("src")).toContain("role-pm");
    expect(container.querySelector("[data-orbit]")).toBeNull();
  });

  it("describes the portrait style in the image alt text", () => {
    wrap(<RoleWheel />);
    expect(screen.getAllByRole("img", { name: en.hero.wheel.alt.fullstack }).length).toBeGreaterThan(0);
  });
});

describe("RolePanels", () => {
  it("opens only the panel of the chosen role, with its four chips", async () => {
    stubMedia(reduced);
    const { container } = wrap(<RoleStage />);
    fireEvent.click(screen.getByRole("radio", { name: "TECH LEAD" }));
    const active = container.querySelector<HTMLElement>("[data-panel='techlead']")!;
    expect(active).toHaveAttribute("data-state", "active");
    for (const chip of en.hero.roles.techlead.chips) expect(within(active).getByText(chip)).toBeInTheDocument();
    for (const key of ["fullstack", "pm"]) {
      const panel = container.querySelector<HTMLElement>(`[data-panel='${key}']`)!;
      expect(panel).toHaveAttribute("data-state", "collapsed");
      expect(panel.querySelector("[data-panel-details]")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("each panel is a pressed-state button that selects its role", async () => {
    stubMedia(reduced);
    wrap(<RolePanels />);
    const pm = screen.getByRole("button", { name: /Technical PM/ });
    expect(pm).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(pm);
    expect(pm).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.style.getPropertyValue("--role-accent")).toBe("#e0a84e");
  });

  it("hovering an arc lights up that role's panel without choosing it", () => {
    stubMedia(reduced);
    const { container } = wrap(<RoleStage />);
    fireEvent.pointerEnter(screen.getByRole("radio", { name: "TECH LEAD" }));
    expect(container.querySelector("[data-panel='techlead']")).toHaveAttribute("data-state", "active");
    expect(container.querySelector("[data-panel='fullstack']")).toHaveAttribute("data-state", "collapsed");
    expect(screen.getByRole("radio", { name: "DEVELOPER" })).toHaveAttribute("aria-checked", "true");
  });

  it("renders the title with its accent word and the escaped <builds/> tag", () => {
    stubMedia(reduced);
    wrap(<RolePanels />);
    const dev = screen.getByRole("button", { name: /Developer/ });
    expect(dev.textContent).toContain("<builds/>");
    expect(within(dev).getByText(en.hero.roles.fullstack.accent).tagName).toBe("EM");
  });
});

describe("HeroStats", () => {
  it("shows 14, 6, 2 and N3 under reduced motion", () => {
    stubMedia(reduced);
    wrap(<HeroStats />);
    for (const n of ["14", "6", "2"]) expect(screen.getByLabelText(n)).toBeInTheDocument();
    expect(screen.getByText("N3")).toBeInTheDocument();
    expect(screen.getByText(en.hero.stats.monthsAtSkg)).toBeInTheDocument();
  });
});

describe("ProfileStatusCard", () => {
  const props = {
    openToWork: true,
    availabilityNote: content.profile.availabilityNote.en,
    location: "Ho Chi Minh City",
    email: content.profile.email,
    cvUrls: { fullstack: "/cv/a.pdf", techlead: "/cv/b.pdf", pm: "/cv/c.pdf" },
  };

  it("copies the public email and confirms it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wrap(<ProfileStatusCard {...props} />);
    await userEvent.click(screen.getByRole("button", { name: en.hero.status.copyEmail }));
    expect(writeText).toHaveBeenCalledWith("letcal2003@gmail.com");
    expect(await screen.findByText(en.hero.status.copied)).toBeInTheDocument();
  });

  it("shows open to work, the city and a CV link for the current role, and never a phone number", () => {
    const { container } = wrap(<ProfileStatusCard {...props} />);
    expect(screen.getByText("Open to work")).toBeInTheDocument();
    expect(screen.getByText(props.availabilityNote)).toBeInTheDocument();
    expect(screen.getByText("Ho Chi Minh City")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.hero.downloadCv })).toHaveAttribute("href", "/cv/a.pdf");
    expect(container.textContent).not.toMatch(/\+84|0964/);
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it("hides the badge when not open to work", () => {
    wrap(<ProfileStatusCard {...props} openToWork={false} />);
    expect(screen.queryByText("Open to work")).not.toBeInTheDocument();
    expect(screen.queryByText(props.availabilityNote)).not.toBeInTheDocument();
  });
});

describe("NameMarquee", () => {
  it("contains the name in English, Japanese and Vietnamese", () => {
    const { container } = wrap(<NameMarquee name="Le Tran Cat Lam" />);
    expect(container.textContent).toContain("Le Tran Cat Lam");
    expect(container.textContent).toContain("レ・チャン・カット・ラム");
    expect(container.textContent).toContain("Lê Trần Cát Lâm");
  });
});

describe("RotatingPhrase", () => {
  it("keeps the first phrase under reduced motion", () => {
    stubMedia(reduced);
    vi.useFakeTimers();
    const { container } = wrap(<RotatingPhrase />);
    expect(container.textContent).toContain("I build web apps for Japanese clients");
    act(() => vi.advanceTimersByTime(5000));
    expect(container.textContent).toContain("web apps");
    expect(container.textContent).not.toContain("AI agents");
  });

  it("cycles to the next phrase every 2.2 seconds", () => {
    stubMedia(() => false);
    vi.useFakeTimers();
    const { container } = wrap(<RotatingPhrase />);
    act(() => vi.advanceTimersByTime(2300));
    expect(container.querySelector("[data-phrase-current]")?.textContent).toBe("AI agents");
  });
});

describe("QuickFacts", () => {
  const education = { school: "FPT University", major: "Software Engineering", gpa: "7.66/10" };

  it("renders four cards with facts from content and messages", () => {
    wrap(<QuickFacts education={education} openToWork availabilityNote={content.profile.availabilityNote.en} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("10.82° N, 106.63° E · GMT+7")).toBeInTheDocument();
    expect(screen.getByText(/Japanese JLPT N3/)).toBeInTheDocument();
    expect(screen.getByText(/GPA 7\.66\/10/)).toBeInTheDocument();
    expect(screen.getByText("FPT University")).toBeInTheDocument();
  });
});
