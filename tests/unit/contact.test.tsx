import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi_ from "@/messages/vi.json";
import seed from "@/content/seed.json";
import { contentSchema, type Content, type Locale } from "@/content/schema";

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: "" }));
const toastMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/en",
}));
vi.mock("sonner", () => ({ toast: toastMock }));

import { Contact } from "@/components/sections/Contact";
import { FooterPrinciples } from "@/components/site/FooterPrinciples";
import { RoleProvider } from "@/components/site/RoleProvider";

const base: Content = contentSchema.parse(seed);
const messages = { en, ja, vi: vi_ } as const;

function stubBrowser(media: (q: string) => boolean = () => false) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: media(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

/** IntersectionObserver whose callback the test fires by hand. */
class FakeIO {
  static instances: FakeIO[] = [];
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    FakeIO.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  fire(isIntersecting: boolean) {
    this.cb([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function renderContact(opts: { role?: string; locale?: Locale; bookingUrl?: string | null; openToWork?: boolean } = {}) {
  search.value = opts.role ? `role=${opts.role}` : "";
  const locale = opts.locale ?? "en";
  const content: Content = {
    ...base,
    profile: {
      ...base.profile,
      bookingUrl: opts.bookingUrl === undefined ? null : opts.bookingUrl,
      openToWork: opts.openToWork ?? true,
    },
  };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <RoleProvider>
        <Contact content={content} locale={locale} />
      </RoleProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  replace.mockClear();
  toastMock.mockClear();
  FakeIO.instances = [];
  stubBrowser();
  window.history.replaceState(null, "", "/en");
});
afterEach(() => vi.unstubAllGlobals());

describe("Contact section", () => {
  it("is the #contact section, labelled by its giant headline (h2)", () => {
    const { container } = renderContact();
    const section = container.querySelector("section#contact");
    expect(section).not.toBeNull();
    const heading = screen.getByRole("heading", { level: 2, name: "Let's build together" });
    expect(section).toContainElement(heading);
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
    expect(heading.className).toContain("text-[clamp(3rem,10vw,9rem)]");
  });

  it.each([
    ["ja", "一緒に作りましょう"],
    ["vi", "Cùng nhau xây dựng"],
  ] as const)("has a %s headline", (locale, text) => {
    renderContact({ locale });
    expect(screen.getByRole("heading", { level: 2, name: text })).toBeInTheDocument();
  });

  it("has the 160px round Get in touch button: a mailto link with id contact-core", () => {
    renderContact();
    const cta = screen.getByRole("link", { name: "Get in touch" });
    expect(cta.getAttribute("href")).toMatch(/^mailto:letcal2003@gmail\.com/);
    expect(cta).toHaveAttribute("id", "contact-core");
    expect(cta.className).toContain("size-40");
    expect(cta.className).toContain("rounded-full");
    expect(document.querySelectorAll("#contact-core")).toHaveLength(1);
  });

  it("paints the Get in touch label with the accent-contrast colour on the accent fill", () => {
    renderContact();
    const cta = screen.getByRole("link", { name: "Get in touch" });
    expect(cta.className).toContain("bg-[var(--role-accent)]");
    expect(cta.className).toContain("text-[var(--role-accent-contrast)]");
  });

  it("copies the email, then shows the Copied toast", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    renderContact();
    await user.click(screen.getByRole("button", { name: "Copy email" }));
    expect(writeText).toHaveBeenCalledWith("letcal2003@gmail.com");
    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
    expect(toastMock.mock.calls[0][0]).toBe("Copied");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("links LinkedIn and GitHub from the profile, opening in a new tab", () => {
    renderContact();
    const li = screen.getByRole("link", { name: /LinkedIn/ });
    expect(li).toHaveAttribute("href", "https://www.linkedin.com/in/letcal");
    expect(li).toHaveAttribute("target", "_blank");
    expect(li.getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", "https://github.com/Let-cal");
  });

  it("shows the booking button only when bookingUrl is not null", () => {
    const { unmount } = renderContact({ bookingUrl: null });
    expect(screen.queryByRole("link", { name: "Book a call" })).not.toBeInTheDocument();
    unmount();
    renderContact({ bookingUrl: "https://cal.example.com/lam" });
    const booking = screen.getByRole("link", { name: "Book a call" });
    expect(booking).toHaveAttribute("href", "https://cal.example.com/lam");
    expect(booking).toHaveAttribute("target", "_blank");
  });

  it("links the CV of the current role", () => {
    renderContact();
    expect(screen.getByRole("link", { name: "Download CV" })).toHaveAttribute("href", "/cv/LeTranCatLam_CV_TechLead.pdf");
  });

  it("switches the CV link to the PM CV when ?role=pm", async () => {
    renderContact({ role: "pm" });
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Download CV" })).toHaveAttribute("href", "/cv/LeTranCatLam_CV_TechnicalPM.pdf"),
    );
    expect(screen.getByRole("link", { name: "Download CV" })).toHaveAttribute("download");
  });

  it("shows the open-to-work status with the note and the Ho Chi Minh City local time, hidden when false", () => {
    const { unmount } = renderContact({ openToWork: true });
    expect(screen.getByText("Open to work")).toBeInTheDocument();
    expect(screen.getByText(base.profile.availabilityNote.en)).toBeInTheDocument();
    expect(screen.getByText(/Ho Chi Minh City/)).toBeInTheDocument();
    expect(screen.getByText(/\(GMT\+7\)/)).toBeInTheDocument();
    unmount();
    renderContact({ openToWork: false });
    expect(screen.queryByText("Open to work")).not.toBeInTheDocument();
    expect(screen.queryByText(base.profile.availabilityNote.en)).not.toBeInTheDocument();
  });

  it.each(["en", "ja", "vi"] as const)("never renders a phone number (%s)", (locale) => {
    const { container } = renderContact({ locale, bookingUrl: "https://cal.example.com/lam" });
    expect(container.textContent).not.toMatch(/\+84|0964/);
    expect(container.innerHTML).not.toMatch(/\+84|0964/);
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });

  it("holds the headline letters back until it scrolls into view, then lets them play", async () => {
    vi.stubGlobal("IntersectionObserver", FakeIO);
    const { container } = renderContact();
    const headline = container.querySelector("[data-contact-headline]")!;
    await waitFor(() => expect(FakeIO.instances.length).toBeGreaterThan(0));
    act(() => FakeIO.instances.forEach((io) => io.fire(false)));
    await waitFor(() => expect(headline).toHaveAttribute("data-held"));
    act(() => FakeIO.instances.forEach((io) => io.fire(true)));
    await waitFor(() => expect(headline).not.toHaveAttribute("data-held"));
  });
});

describe("Footer principles", () => {
  function renderPrinciples(locale: Locale = "en") {
    return render(
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        <FooterPrinciples />
      </NextIntlClientProvider>,
    );
  }

  it("is protected from the 3D scene like the rest of the text: the label and the list carry data-scene-avoid", () => {
    const { container } = renderPrinciples();
    expect(container.querySelector("h2")).toHaveAttribute("data-scene-avoid");
    expect(screen.getByRole("list", { name: "How I work" })).toHaveAttribute("data-scene-avoid", "box");
  });

  it("lists at least 3 principles, in order", () => {
    renderPrinciples();
    const list = screen.getByRole("list", { name: "How I work" });
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items.map((li) => li.textContent)).toEqual(expect.arrayContaining([expect.stringContaining(en.footer.principles[0])]));
  });

  it("staggers the reveal: each line has a growing delay index", () => {
    renderPrinciples();
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.style.getPropertyValue("--i"))).toEqual(items.map((_, i) => String(i)));
  });

  it("hides the lines until the footer scrolls into view, then reveals them", async () => {
    vi.stubGlobal("IntersectionObserver", FakeIO);
    renderPrinciples();
    const list = screen.getByRole("list", { name: "How I work" });
    await waitFor(() => expect(FakeIO.instances.length).toBeGreaterThan(0));
    act(() => FakeIO.instances.forEach((io) => io.fire(false)));
    await waitFor(() => expect(list).toHaveAttribute("data-armed"));
    expect(list).not.toHaveAttribute("data-shown");
    act(() => FakeIO.instances.forEach((io) => io.fire(true)));
    await waitFor(() => expect(list).toHaveAttribute("data-shown"));
  });

  it("always has the lines in the DOM (static state when there is no IntersectionObserver)", () => {
    renderPrinciples("ja");
    expect(screen.getAllByRole("listitem")).toHaveLength(ja.footer.principles.length);
    expect(screen.getByText(ja.footer.principles[0])).toBeVisible();
  });
});

describe("footer.principles messages", () => {
  const banned = [
    "spearheaded",
    "orchestrated",
    "leveraged",
    "synergy",
    "foster",
    "transformative",
    "seamless",
    "cutting-edge",
    "dynamic",
    "passionate",
    "empower",
    "game-changer",
    "multifaceted",
    "unwavering",
    "thought leader",
    "proven track record",
    "deep dive",
  ];

  it.each(Object.entries(messages))("%s has 3 to 5 non-empty principles with no banned word and no digits", (_locale, bundle) => {
    const list = bundle.footer.principles as string[];
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.length).toBeLessThanOrEqual(5);
    for (const line of list) {
      expect(line.trim()).not.toBe("");
      expect(line).not.toMatch(/\d/);
      expect(line).not.toContain("—");
      for (const word of banned) expect(line.toLowerCase()).not.toContain(word);
    }
  });

  it("the three locales have the same number of principles", () => {
    expect(ja.footer.principles).toHaveLength(en.footer.principles.length);
    expect(vi_.footer.principles).toHaveLength(en.footer.principles.length);
  });
});
