import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi_ from "@/messages/vi.json";
import seed from "@/content/seed.json";
import { contentSchema, type Content, type Locale } from "@/content/schema";
import { Certificates } from "@/components/sections/Certificates";

import { stubIntersectionObserver } from "../helpers/io-stub";

const base: Content = contentSchema.parse(seed);
const messages = { en, ja, vi: vi_ } as const;

function renderCerts(opts: { locale?: Locale; content?: Content } = {}) {
  const locale = opts.locale ?? "en";
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <Certificates content={opts.content ?? base} locale={locale} />
    </NextIntlClientProvider>,
  );
}

const JLPT = /Japanese Language Proficiency Test/;
const lanternOf = (button: HTMLElement) => button.closest("li") as HTMLElement;
const backOf = (button: HTMLElement) => lanternOf(button).querySelector("[data-lantern-back]") as HTMLElement;

// These tests render sections that contain <Reveal>, whose whileInView needs an IntersectionObserver.
beforeEach(() => stubIntersectionObserver());
afterEach(() => vi.unstubAllGlobals());

describe("Certificates section", () => {
  it("is a section labelled by its heading", () => {
    renderCerts();
    const section = document.getElementById("certificates");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByRole("heading", { level: 2, name: "Certificates" })).toBeInTheDocument();
  });

  it("has a Certificates tab and an Activities tab, Certificates first and selected", () => {
    renderCerts();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Certificates", "Activities"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel", { name: "Certificates" })).toBeInTheDocument();
  });

  it("switches to the activities with a click and with the arrow keys", async () => {
    const user = userEvent.setup();
    renderCerts();
    await user.click(screen.getByRole("tab", { name: "Activities" }));
    expect(screen.getByRole("tab", { name: "Activities" })).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel", { name: "Activities" });
    expect(within(panel).getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(within(panel).getByText("Cultural activities")).toBeInTheDocument();
    // Dates are shown as a year only: the source records no day or month.
    expect(within(panel).getByText("2022")).toBeInTheDocument();
    expect(within(panel).getByText("Leadership")).toBeInTheDocument();
    expect(screen.queryByRole("tabpanel", { name: "Certificates" })).toBeNull();

    screen.getByRole("tab", { name: "Activities" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Certificates" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Certificates" })).toHaveFocus();
  });

  it("the selected tab uses the accent-contrast text colour, the other one does not", () => {
    renderCerts();
    expect(screen.getByRole("tab", { name: "Certificates" })).toHaveClass("text-(--role-accent-contrast)");
    expect(screen.getByRole("tab", { name: "Certificates" })).not.toHaveClass("text-background");
    expect(screen.getByRole("tab", { name: "Activities" })).not.toHaveClass("text-(--role-accent-contrast)");
  });

  it("only the selected tab is in the tab order", () => {
    renderCerts();
    expect(screen.getByRole("tab", { name: "Certificates" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Activities" })).toHaveAttribute("tabindex", "-1");
  });

  it("offers the topic filter All, Language, PM, UX/Design, Engineering, Other with a count each", () => {
    renderCerts();
    const group = screen.getByRole("radiogroup", { name: "Filter by topic" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual([
      "All10",
      "Language2",
      "PM1",
      "UX/Design2",
      "Engineering2",
      "Other3",
    ]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(10);
  });

  it("choosing Language keeps only the language certificates", async () => {
    const user = userEvent.setup();
    renderCerts();
    await user.click(screen.getByRole("radio", { name: /^Language/ }));
    expect(screen.getByRole("radio", { name: /^Language/ })).toHaveAttribute("aria-checked", "true");
    const panel = screen.getByRole("tabpanel", { name: "Certificates" });
    const names = within(panel)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(names).toHaveLength(2);
    expect(names[0]).toMatch(JLPT);
    expect(names[1]).toMatch(/Academic English: Writing/);
    expect(screen.queryByRole("button", { name: /Project Management Principles/ })).toBeNull();
  });

  it("with one language certificate left, Language shows only JLPT N3", async () => {
    const user = userEvent.setup();
    const content: Content = {
      ...base,
      certificates: base.certificates.map((c) => (c.id === "coursera-academic-english-writing" ? { ...c, published: false } : c)),
    };
    renderCerts({ content });
    await user.click(screen.getByRole("radio", { name: /^Language/ }));
    const panel = screen.getByRole("tabpanel", { name: "Certificates" });
    const buttons = within(panel).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toMatch(JLPT);
    await user.click(screen.getByRole("radio", { name: /^All/ }));
    expect(within(panel).getAllByRole("button")).toHaveLength(9);
  });

  it("does not render, or count, an unpublished certificate", () => {
    const content: Content = {
      ...base,
      certificates: base.certificates.map((c) => (c.id === "coursera-sdlc" ? { ...c, published: false } : c)),
    };
    renderCerts({ content });
    expect(screen.queryByRole("button", { name: /Software Development Lifecycle/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /^All/ }).textContent).toBe("All9");
    expect(screen.getByRole("radio", { name: /^Engineering/ }).textContent).toBe("Engineering1");
  });

  it("hides a topic with no certificate", () => {
    const content: Content = { ...base, certificates: base.certificates.filter((c) => c.topic !== "pm") };
    renderCerts({ content });
    expect(screen.queryByRole("radio", { name: /^PM/ })).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("announces how many certificates the filter leaves", async () => {
    const user = userEvent.setup();
    renderCerts();
    await user.click(screen.getByRole("radio", { name: /^PM/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 10 certificates");
  });

  it("filters by keyboard: arrows move and select the topic", async () => {
    const user = userEvent.setup();
    renderCerts();
    screen.getByRole("radio", { name: /^All/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /^Language/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^Language/ })).toHaveFocus();
    // roving tabindex: only the checked radio is a tab stop
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("tabindex") === "0")).toHaveLength(1);
  });
});

describe("Lantern card", () => {
  it("shows name, organization and issue date on the front, one toggle button per card", () => {
    renderCerts();
    const card = screen.getByRole("button", { name: /Japanese Language Proficiency Test/ });
    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(card).toHaveAccessibleName(/Japan Foundation/);
    expect(card).toHaveAccessibleName(/Dec 2024/);
    expect(card.tagName).toBe("BUTTON");
  });

  it("keeps the back out of the tab order and the accessibility tree until the card is flipped", () => {
    renderCerts();
    const card = screen.getByRole("button", { name: /Coursera|Computer Communications/ });
    const back = backOf(card);
    expect(back).toHaveAttribute("inert");
    expect(back).toHaveAttribute("aria-hidden", "true");
    expect(within(lanternOf(card)).queryByRole("link")).toBeNull();
  });

  it("Enter on a card sets aria-pressed and reveals the credential ID and the Verify link", async () => {
    const user = userEvent.setup();
    renderCerts();
    const card = screen.getByRole("button", { name: /Computer Communications/ });
    card.focus();
    await user.keyboard("{Enter}");
    expect(card).toHaveAttribute("aria-pressed", "true");
    const back = backOf(card);
    expect(back).not.toHaveAttribute("inert");
    expect(back).not.toHaveAttribute("aria-hidden");
    expect(within(back).getByText("4FNLNT8AY6V7")).toBeInTheDocument();
    const verify = within(lanternOf(card)).getByRole("link", { name: /Verify/ });
    expect(verify).toHaveAttribute("href", "https://coursera.org/share/09e0cf48c02eac4d8b02617da51689cf");
    await user.keyboard("{Enter}");
    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(backOf(card)).toHaveAttribute("inert");
  });

  it("shows a dash when the certificate has no credential ID", async () => {
    const user = userEvent.setup();
    renderCerts();
    const card = screen.getByRole("button", { name: JLPT });
    card.focus();
    await user.keyboard("{Enter}");
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(within(backOf(card)).getByText("—")).toBeInTheDocument();
    expect(within(backOf(card)).getByText("Credential ID")).toBeInTheDocument();
  });

  it("Space and click also flip the card, Escape flips it back and returns focus to the card", async () => {
    const user = userEvent.setup();
    renderCerts();
    const card = screen.getByRole("button", { name: /Computer Communications/ });
    card.focus();
    await user.keyboard(" ");
    expect(card).toHaveAttribute("aria-pressed", "true");
    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "false");
    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    await user.tab();
    expect(within(lanternOf(card)).getByRole("link", { name: /Verify/ })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(card).toHaveFocus();
  });

  it("flips cards independently", async () => {
    const user = userEvent.setup();
    renderCerts();
    await user.click(screen.getByRole("button", { name: /Computer Communications/ }));
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(9);
  });

  it("opens the Verify link in a new tab safely, with a screen-reader cue", async () => {
    const user = userEvent.setup();
    renderCerts();
    await user.click(screen.getByRole("button", { name: /Computer Communications/ }));
    const verify = within(lanternOf(screen.getByRole("button", { name: /Computer Communications/ }))).getByRole("link", { name: /Verify/ });
    expect(verify).toHaveAttribute("target", "_blank");
    expect(verify).toHaveAttribute("rel", "noopener noreferrer");
    expect(verify).toHaveAccessibleName(/^Verify\s*\(opens in new tab\)$/);
  });

  it("every Verify link in the section opens a new tab with rel noopener noreferrer", () => {
    renderCerts();
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("#certificates [data-lantern-back] a[data-verify]"));
    expect(links).toHaveLength(10);
    for (const a of links) {
      expect(a.target).toBe("_blank");
      expect(a.rel).toBe("noopener noreferrer");
    }
  });

  it("has no Verify link without a credential URL and a View file link only with a file", async () => {
    const user = userEvent.setup();
    const content: Content = {
      ...base,
      certificates: base.certificates.map((c) =>
        c.id === "coursera-sdlc"
          ? { ...c, credentialUrl: null }
          : c.id === "coursera-computer-communications"
            ? { ...c, fileUrl: "/files/cc.pdf" }
            : c,
      ),
    };
    renderCerts({ content });
    const sdlc = screen.getByRole("button", { name: /Software Development Lifecycle/ });
    await user.click(sdlc);
    expect(within(lanternOf(sdlc)).queryByRole("link", { name: /Verify/ })).toBeNull();
    expect(within(lanternOf(sdlc)).queryByRole("link", { name: /View file/ })).toBeNull();

    const cc = screen.getByRole("button", { name: /Computer Communications/ });
    await user.click(cc);
    const file = within(lanternOf(cc)).getByRole("link", { name: /View file/ });
    expect(file).toHaveAttribute("href", "/files/cc.pdf");
    expect(file).toHaveAttribute("target", "_blank");
    expect(file).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("is localized: Japanese labels, dates and topics", () => {
    renderCerts({ locale: "ja" });
    expect(screen.getByRole("radiogroup", { name: ja.certificates.filterLabel })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: new RegExp(`^${ja.certificates.topics.language}`) })).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /日本語能力試験|Japanese Language/ });
    expect(card).toHaveAccessibleName(/2024年12月/);
  });
});
