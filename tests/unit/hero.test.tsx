import { render, screen, within } from "@testing-library/react";
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
  default: ({ priority, fill, ...props }: Record<string, unknown>) => {
    void priority;
    void fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...(props as object)} alt={String(props.alt)} data-priority={String(priority)} />;
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

describe("Hero", () => {
  beforeEach(() => {
    replace.mockClear();
    window.history.replaceState(null, "", "/en");
  });

  it("renders the name as the only h1 inside the hero section", () => {
    renderHero();
    expect(screen.getByRole("heading", { level: 1, name: "Le Tran Cat Lam" })).toBeInTheDocument();
    expect(document.getElementById("hero")).toContainElement(screen.getByRole("heading", { level: 1 }));
  });

  it("shows the title and summary of the default role before ?role= is applied", () => {
    renderHero();
    expect(screen.getByText("Full-stack Software Engineer")).toBeInTheDocument();
    expect(screen.getByText(content.profile.summaries.fullstack.en)).toBeInTheDocument();
  });

  it("shows the pm title and summary and the pm CV when ?role=pm", async () => {
    renderHero({ role: "pm" });
    expect(await screen.findByText("Software Engineer · Technical Project Manager")).toBeInTheDocument();
    expect(screen.getByText(content.profile.summaries.pm.en)).toBeInTheDocument();
    expect(screen.queryByText(content.profile.summaries.fullstack.en)).not.toBeInTheDocument();
    const cv = screen.getByRole("link", { name: "Download CV" });
    expect(cv).toHaveAttribute("href", "/cv/LeTranCatLam_CV_TechnicalPM.pdf");
    expect(cv).toHaveAttribute("download");
  });

  it("links the 60-second view to the quick route with the chosen role, and Contact to #contact", async () => {
    renderHero({ role: "techlead", locale: "ja" });
    const quick = await screen.findByRole("link", { name: ja.hero.quickView });
    expect(quick).toHaveAttribute("href", "/ja/quick?role=techlead");
    expect(screen.getByRole("link", { name: ja.hero.contact })).toHaveAttribute("href", "#contact");
  });

  it("has the three CTAs by name", () => {
    renderHero();
    expect(screen.getByRole("link", { name: "Download CV" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "60-second view" })).toBeInTheDocument();
  });

  it("shows the Open to work badge only when openToWork is true", () => {
    const { unmount } = renderHero({ openToWork: true });
    expect(screen.getByText("Open to work")).toBeInTheDocument();
    expect(screen.getByText(content.profile.availabilityNote.en)).toBeInTheDocument();
    unmount();
    renderHero({ openToWork: false });
    expect(screen.queryByText("Open to work")).not.toBeInTheDocument();
    expect(screen.queryByText(content.profile.availabilityNote.en)).not.toBeInTheDocument();
  });

  it("renders a lazy portrait with sizes, and an empty water zone for the fish", () => {
    const { container } = renderHero();
    const img = screen.getByRole("img", { name: /Le Tran Cat Lam/ });
    expect(img).toHaveAttribute("sizes");
    expect(img).toHaveAttribute("data-priority", "false");
    const zone = container.querySelector("[data-water-zone]");
    expect(zone).not.toBeNull();
    expect(zone).toBeEmptyDOMElement();
    expect(zone).toHaveAttribute("aria-hidden", "true");
  });

  it("never renders a phone number", () => {
    const { container } = renderHero();
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });
});

describe("RoleSwitcher in the Hero", () => {
  beforeEach(() => {
    replace.mockClear();
    window.history.replaceState(null, "", "/en");
  });

  it("is a radiogroup of 3 radios with the current role checked", async () => {
    renderHero({ role: "pm" });
    const group = screen.getByRole("radiogroup", { name: "Role" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Full-stack", "Tech Lead", "Project Manager"]);
    expect(await within(group).findByRole("radio", { name: "Project Manager", checked: true })).toBeInTheDocument();
  });

  it("clicking a role switches title, summary and the URL", async () => {
    renderHero();
    await userEvent.click(screen.getByRole("radio", { name: "Tech Lead" }));
    expect(screen.getByText("Software Engineer · Tech Lead")).toBeInTheDocument();
    expect(screen.getByText(content.profile.summaries.techlead.en)).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/en?role=techlead", { scroll: false });
  });

  it("arrow keys move between roles (roving tabindex)", async () => {
    renderHero();
    const fs = screen.getByRole("radio", { name: "Full-stack" });
    expect(fs).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Tech Lead" })).toHaveAttribute("tabindex", "-1");
    fs.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Tech Lead", checked: true })).toHaveFocus();
  });
});
