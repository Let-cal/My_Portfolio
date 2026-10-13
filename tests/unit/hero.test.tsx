import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import seed from "@/content/seed.json";
import { contentSchema, type Content, type Locale } from "@/content/schema";

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/en",
}));
// next/image would try to optimise the file; a plain <img> keeps the props visible to the test.
vi.mock("next/image", () => ({
  default: ({ preload, fill, fetchPriority, ...props }: Record<string, unknown>) => {
    void preload;
    void fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...(props as object)} alt={String(props.alt)} data-fetch-priority={String(fetchPriority)} />;
  },
}));

import { Hero } from "@/components/sections/Hero";
import { RoleProvider } from "@/components/site/RoleProvider";

const content: Content = contentSchema.parse(seed);

function renderHero(opts: { role?: string; openToWork?: boolean; locale?: Locale } = {}) {
  search.value = opts.role ? `role=${opts.role}` : "";
  const c: Content = { ...content, profile: { ...content.profile, openToWork: opts.openToWork ?? true } };
  const locale = opts.locale ?? "en";
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : en}>
      <RoleProvider>
        <Hero content={c} locale={locale} />
      </RoleProvider>
    </NextIntlClientProvider>,
  );
}

/** The role title is a TextScramble: its final text lives in an sr-only span. */
const title = (text: string) => screen.getByText(text, { selector: "#hero-title .sr-only" });

describe("Hero", () => {
  beforeEach(() => {
    replace.mockClear();
    window.history.replaceState(null, "", "/en");
  });

  it("renders the name as the only h1 inside the hero section", () => {
    renderHero();
    expect(screen.getByRole("heading", { level: 1, name: "Le Tran Cat Lam" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(document.getElementById("hero")).toContainElement(screen.getByRole("heading", { level: 1 }));
  });

  it("shows the title and summary of the default role before ?role= is applied", () => {
    renderHero();
    expect(title("Full-stack Software Engineer")).toBeInTheDocument();
    expect(screen.getByText(content.profile.summaries.fullstack.en)).toBeInTheDocument();
  });

  it("shows the pm title and summary and the pm CV when ?role=pm", async () => {
    renderHero({ role: "pm" });
    await waitFor(() => expect(title("Software Engineer · Technical Project Manager")).toBeInTheDocument());
    expect(await screen.findByText(content.profile.summaries.pm.en)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(content.profile.summaries.fullstack.en)).not.toBeInTheDocument());
    const cvs = screen.getAllByRole("link", { name: "Download CV" });
    expect(cvs.length).toBeGreaterThan(0);
    for (const cv of cvs) {
      expect(cv).toHaveAttribute("href", "/cv/LeTranCatLam_CV_TechnicalPM.pdf");
      expect(cv).toHaveAttribute("download");
    }
  });

  it("links the 60-second view to the quick route with the chosen role, and Contact to #contact", async () => {
    renderHero({ role: "techlead", locale: "ja" });
    const quick = await screen.findByRole("link", { name: ja.hero.quickView });
    await waitFor(() => expect(quick).toHaveAttribute("href", "/ja/quick?role=techlead"));
    expect(screen.getByRole("link", { name: ja.hero.contact })).toHaveAttribute("href", "#contact");
  });

  it("has the three CTAs by name", () => {
    renderHero();
    expect(screen.getAllByRole("link", { name: "Download CV" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "60-second view" })).toBeInTheDocument();
  });

  it("shows the Open to work badge only when openToWork is true", () => {
    const { unmount } = renderHero({ openToWork: true });
    expect(screen.getAllByText("Open to work").length).toBeGreaterThan(0);
    expect(screen.getAllByText(content.profile.availabilityNote.en).length).toBeGreaterThan(0);
    unmount();
    renderHero({ openToWork: false });
    expect(screen.queryByText("Open to work")).not.toBeInTheDocument();
    expect(screen.queryByText(content.profile.availabilityNote.en)).not.toBeInTheDocument();
  });

  it("renders the wheel portrait with sizes and high fetch priority, and an empty water zone for the fish", () => {
    const { container } = renderHero();
    const img = container.querySelector("[data-layer='base'] img")!;
    expect(img).toHaveAttribute("sizes");
    expect(img).toHaveAttribute("data-fetch-priority", "high");
    expect(img.getAttribute("alt")).toBe(en.hero.wheel.alt.fullstack);
    const zone = container.querySelector("[data-water-zone]");
    expect(zone).not.toBeNull();
    expect(zone).toBeEmptyDOMElement();
    expect(zone).toHaveAttribute("aria-hidden", "true");
  });

  it("never renders a phone number", () => {
    const { container } = renderHero();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.textContent).not.toMatch(/\+84|0964/);
  });
});

describe("Role wheel in the Hero", () => {
  beforeEach(() => {
    replace.mockClear();
    window.history.replaceState(null, "", "/en");
  });

  it("replaces the pill switcher: one radiogroup of 3 radios with the current role checked", async () => {
    renderHero({ role: "pm" });
    const groups = screen.getAllByRole("radiogroup");
    expect(groups).toHaveLength(1);
    const radios = within(groups[0]).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["DEVELOPER", "TECH LEAD", "TECHNICAL PM"]);
    expect(await within(groups[0]).findByRole("radio", { name: "TECHNICAL PM", checked: true })).toBeInTheDocument();
  });

  it("clicking a role switches title, summary and the URL", async () => {
    renderHero();
    await userEvent.click(screen.getByRole("radio", { name: "TECH LEAD" }));
    expect(title("Software Engineer · Tech Lead")).toBeInTheDocument();
    expect(await screen.findByText(content.profile.summaries.techlead.en)).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/en?role=techlead", { scroll: false });
  });

  it("arrow keys move between roles (roving tabindex)", async () => {
    renderHero();
    const dev = screen.getByRole("radio", { name: "DEVELOPER" });
    expect(dev).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "TECH LEAD" })).toHaveAttribute("tabindex", "-1");
    act(() => dev.focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "TECH LEAD", checked: true })).toHaveFocus();
  });
});
