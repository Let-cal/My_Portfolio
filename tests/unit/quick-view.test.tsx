import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Activity } from "react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { contentSchema, type Locale, type RoleKey } from "@/content/schema";
import seed from "@/content/seed.json";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi_ from "@/messages/vi.json";

vi.mock("@/i18n/navigation", () => ({ usePathname: () => "/en/quick", getPathname: () => "/en/quick" }));
vi.mock("@/components/site/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/site/LanguageSwitch", () => ({ LanguageSwitch: () => null }));

import { QuickView } from "@/components/quick/QuickView";

const content = contentSchema.parse(seed);
const messages = { en, ja, vi: vi_ } as const;

function renderQuick(role: RoleKey = "fullstack", locale: Locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <QuickView content={content} locale={locale} role={role} />
    </NextIntlClientProvider>,
  );
}

describe("QuickView", () => {
  it("shows the name, the title of the role and the summary", () => {
    renderQuick("pm");
    expect(screen.getByRole("heading", { level: 1, name: "Le Tran Cat Lam" })).toBeInTheDocument();
    expect(document.getElementById("quick-title")).toHaveTextContent("Software Engineer · Technical Project Manager");
    expect(screen.getByText(/acting Project Manager at SKG Software/)).toBeInTheDocument();
  });

  it("lists four experiences and four certificates", () => {
    const { container } = renderQuick("techlead");
    expect(container.querySelectorAll("[data-quick-experience]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-quick-certificate]")).toHaveLength(4);
  });

  it("has a CV download for the role, a Print button and a link back to the full site", () => {
    renderQuick("pm");
    expect(screen.getByRole("link", { name: /Download CV/ })).toHaveAttribute("href", expect.stringMatching(/TechnicalPM\.pdf$/));
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to full site" })).toHaveAttribute("href", "/en?role=pm");
  });

  it("links back to the bare locale for the default role", () => {
    renderQuick("fullstack", "vi");
    expect(screen.getByRole("link", { name: "Quay lại trang đầy đủ" })).toHaveAttribute("href", "/vi");
  });

  it("Print calls window.print", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderQuick();
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it("marks the root for the print stylesheet and renders no canvas, phone or undefined", () => {
    const { container } = renderQuick("pm", "ja");
    expect(container.querySelector("main[data-quick-view]")).not.toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
    const text = container.textContent ?? "";
    expect(text).not.toContain("undefined");
    expect(text).not.toMatch(/\+?\d[\d\s().-]{8,}\d/);
    expect(within(container).getByRole("heading", { name: "スキル" })).toBeInTheDocument();
  });

  it("drops data-quick-view while React keeps the page as a hidden copy, and puts it back when it shows again", () => {
    const tree = (mode: "visible" | "hidden") => (
      <NextIntlClientProvider locale="en" messages={messages.en}>
        <Activity mode={mode}>
          <QuickView content={content} locale="en" role="fullstack" />
        </Activity>
      </NextIntlClientProvider>
    );
    const { container, rerender } = render(tree("visible"));
    const main = container.querySelector("main")!;
    expect(main).toHaveAttribute("data-quick-view");
    rerender(tree("hidden"));
    expect(main).not.toHaveAttribute("data-quick-view");
    rerender(tree("visible"));
    expect(main).toHaveAttribute("data-quick-view");
  });
});

describe("quick-view chrome rule", () => {
  it("does not depend on the style attribute (a :has() over [style] restyles the whole page on every inline style change)", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const hasArgs = [...css.matchAll(/:has\(([^{]*)\{/g)].map((m) => m[1]);
    expect(hasArgs.length).toBeGreaterThan(0);
    for (const arg of hasArgs) expect(arg).not.toMatch(/\[style/);
    expect(css).toMatch(/body:has\(\[data-quick-view\]\)\s*\{/);
  });
});
