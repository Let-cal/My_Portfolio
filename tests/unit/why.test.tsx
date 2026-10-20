import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi_ from "@/messages/vi.json";
import seed from "@/content/seed.json";
import {
  contentSchema,
  whyCardSchema,
  type Content,
  type Locale,
} from "@/content/schema";
import { Why } from "@/components/sections/Why";

const base: Content = contentSchema.parse(seed);
const messages = { en, ja, vi: vi_ } as const;

/** matchMedia stub: `matches` decides per query string. */
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
class FakeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}
function stubBrowser(media: (q: string) => boolean = () => false) {
  stubMedia(media);
  vi.stubGlobal("ResizeObserver", FakeObserver);
  vi.stubGlobal("IntersectionObserver", FakeObserver);
}
function stubRaf() {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

function renderWhy(opts: { locale?: Locale; content?: Content } = {}) {
  const locale = opts.locale ?? "en";
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <Why content={opts.content ?? base} locale={locale} />
    </NextIntlClientProvider>,
  );
}

const region = () =>
  screen.getByRole("region", { name: "Reasons to work with me" });
const cards = () => within(region()).getAllByRole("group", { name: /of 4$/ });

afterEach(() => vi.unstubAllGlobals());

describe("Why section", () => {
  it("is a section labelled by its heading", () => {
    stubBrowser();
    renderWhy();
    const section = document.getElementById("why");
    expect(section).not.toBeNull();
    expect(
      within(section as HTMLElement).getByRole("heading", {
        level: 2,
        name: "Why work with me",
      }),
    ).toBeInTheDocument();
  });

  it("renders all 4 seed cards in sortIndex order, whatever the array order", () => {
    stubBrowser();
    const shuffled: Content = {
      ...base,
      whyCards: [...base.whyCards].reverse(),
    };
    renderWhy({ content: shuffled });
    const titles = cards().map(
      (c) => within(c).getByRole("heading", { level: 3 }).textContent,
    );
    expect(titles).toEqual(
      [...base.whyCards]
        .sort((a, b) => a.sortIndex - b.sortIndex)
        .map((c) => c.title.en),
    );
    expect(titles).toHaveLength(4);
  });

  it("gives every card a 'See evidence' link to its evidenceLink", () => {
    stubBrowser();
    renderWhy();
    const sorted = [...base.whyCards].sort((a, b) => a.sortIndex - b.sortIndex);
    cards().forEach((card, i) => {
      const link = within(card).getByRole("link", { name: /See evidence/ });
      expect(link).toHaveAttribute("href", sorted[i].evidenceLink);
    });
  });

  it("omits the evidence link when a card has none", () => {
    stubBrowser();
    const noLink: Content = {
      ...base,
      whyCards: base.whyCards.map((c, i) =>
        i === 0 ? { ...c, evidenceLink: null } : c,
      ),
    };
    renderWhy({ content: noLink });
    expect(within(cards()[0]).queryByRole("link")).toBeNull();
    expect(within(cards()[1]).getByRole("link")).toBeInTheDocument();
  });

  it("starts on card 1 of 4, and the next button advances the active card by one", async () => {
    stubBrowser();
    const user = userEvent.setup();
    renderWhy();
    expect(screen.getByRole("status")).toHaveTextContent("1 of 4");
    expect(cards()[0]).toHaveAttribute("data-active", "true");
    await user.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 of 4");
    expect(cards()[1]).toHaveAttribute("data-active", "true");
    expect(cards()[0]).not.toHaveAttribute("data-active", "true");
    await user.click(screen.getByRole("button", { name: "Previous card" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 of 4");
  });

  it("announces the current card politely", () => {
    stubBrowser();
    renderWhy();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("ArrowRight / ArrowLeft move the active card while the carousel has focus, and stop at the ends", async () => {
    stubBrowser();
    const user = userEvent.setup();
    renderWhy();
    const carousel = region();
    expect(carousel).toHaveAttribute("tabindex", "0");
    carousel.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("status")).toHaveTextContent("2 of 4");
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("status")).toHaveTextContent("4 of 4");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("status")).toHaveTextContent("3 of 4");
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("status")).toHaveTextContent("1 of 4");
  });

  it("makes a card active when a link inside it receives focus", () => {
    stubBrowser();
    renderWhy();
    act(() => within(cards()[2]).getByRole("link").focus());
    expect(screen.getByRole("status")).toHaveTextContent("3 of 4");
  });

  it("makes the prev/next buttons 50px round buttons with aria-labels", () => {
    stubBrowser();
    renderWhy();
    for (const name of ["Previous card", "Next card"]) {
      expect(screen.getByRole("button", { name })).toHaveClass(
        "size-[50px]",
        "rounded-full",
      );
    }
  });

  it("marks the unreachable direction aria-disabled instead of dropping focus", async () => {
    stubBrowser();
    const user = userEvent.setup();
    renderWhy();
    expect(
      screen.getByRole("button", { name: "Previous card" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("button", { name: "Previous card" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 of 4");
    for (let i = 0; i < 5; i++)
      await user.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByRole("status")).toHaveTextContent("4 of 4");
    expect(screen.getByRole("button", { name: "Next card" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("has one dot per card that jumps to it", async () => {
    stubBrowser();
    const user = userEvent.setup();
    renderWhy();
    await user.click(screen.getByRole("button", { name: "Go to card 3" }));
    expect(screen.getByRole("status")).toHaveTextContent("3 of 4");
    expect(
      screen.getByRole("button", { name: "Go to card 3" }),
    ).toHaveAttribute("aria-current", "true");
  });
});

describe("Why manifesto", () => {
  it.each([
    [
      "en",
      "I turn what Japanese clients ask for into software that has been released",
    ],
    ["ja", "日本のお客様の要望を"],
    ["vi", "Tôi biến yêu cầu của khách hàng Nhật"],
  ] as const)(
    "shows the %s manifesto once for assistive tech, with the visual copy hidden",
    (locale, start) => {
      stubBrowser();
      renderWhy({ locale });
      const full = document.querySelectorAll("[data-manifesto] .sr-only");
      expect(full).toHaveLength(1);
      expect(full[0].textContent).toContain(start);
      const visual = document.querySelector(
        "[data-manifesto] [aria-hidden='true']",
      ) as HTMLElement;
      expect(visual).not.toBeNull();
      expect(visual.textContent?.replace(/\s/g, "")).toBe(
        full[0].textContent?.replace(/\s/g, ""),
      );
    },
  );

  it("avoids the banned words and invented numbers", () => {
    for (const m of [en, ja, vi_]) {
      expect(m.why.manifesto).not.toMatch(/\d/);
      expect(m.why.manifesto).not.toMatch(
        /seamless|spearhead|leverag|passionate|transformative|empower/i,
      );
    }
  });
});

describe("Why stats", () => {
  it("shows each card's real number as the final value when motion is reduced", () => {
    stubBrowser((q) => q.includes("prefers-reduced-motion"));
    renderWhy();
    const stats = cards().map((c) => {
      const ticker = within(c).queryByRole("img");
      return ticker
        ? [
            ticker.getAttribute("aria-label"),
            c.querySelector("[data-stat-label]")?.textContent,
          ]
        : null;
    });
    expect(stats).toEqual([
      ["6", "Japanese client projects in 14 months"],
      ["2", "lockers in the live pilot"],
      ["2", "projects run in parallel"],
      null,
    ]);
    // The counted text itself is already the final value (no half-counted number to read).
    expect(cards()[0].querySelector("[data-ticker-value]")?.textContent).toBe(
      "6",
    );
  });

  it("renders no ticker and no label for a card whose stat is null", () => {
    stubBrowser();
    renderWhy();
    const last = cards()[3];
    expect(within(last).queryByRole("img")).toBeNull();
    expect(last.querySelector("[data-stat-label]")).toBeNull();
  });

  it("keeps a '~' prefix when the stat is an estimate", () => {
    stubBrowser((q) => q.includes("prefers-reduced-motion"));
    const est: Content = {
      ...base,
      whyCards: base.whyCards.map((c, i) =>
        i === 0
          ? {
              ...c,
              stat: {
                value: 300,
                prefix: "~",
                label: {
                  en: "unit tests",
                  ja: "ユニットテスト",
                  vi: "unit test",
                },
              },
            }
          : c,
      ),
    };
    renderWhy({ content: est });
    expect(
      within(cards()[0]).getByRole("img", { name: "~300" }),
    ).toBeInTheDocument();
  });
});

describe("whyCardSchema stat", () => {
  const { stat: _stat, ...withoutStat } = base.whyCards[0];
  void _stat;
  const label = { en: "a", ja: "b", vi: "c" };

  it("accepts stat: null", () => {
    expect(whyCardSchema.parse({ ...withoutStat, stat: null }).stat).toBeNull();
  });
  it("accepts a card with no stat field and reads it as null", () => {
    expect(whyCardSchema.parse(withoutStat).stat).toBeNull();
  });
  it("accepts a full stat with prefix and suffix", () => {
    const parsed = whyCardSchema.parse({
      ...withoutStat,
      stat: { value: 14, prefix: "~", suffix: "+", label },
    });
    expect(parsed.stat).toMatchObject({ value: 14, prefix: "~", suffix: "+" });
  });
  it("rejects a stat without a label or with a non-numeric value", () => {
    expect(
      whyCardSchema.safeParse({ ...withoutStat, stat: { value: 2 } }).success,
    ).toBe(false);
    expect(
      whyCardSchema.safeParse({ ...withoutStat, stat: { value: "2", label } })
        .success,
    ).toBe(false);
  });
  it("seed: P1 2 lockers, parallel 2 projects, Japanese clients 6 projects, UI/UX null", () => {
    const byId = Object.fromEntries(base.whyCards.map((c) => [c.id, c.stat]));
    expect(byId["built-flexybox-p1"]?.value).toBe(2);
    expect(byId["two-projects-in-parallel"]?.value).toBe(2);
    expect(byId["japanese-clients"]?.value).toBe(6);
    expect(byId["ui-ux-motion"]).toBeNull();
  });
});

describe("Why card pointer effects", () => {
  const firstCard = () =>
    cards()[0].querySelector("[data-why-card]") as HTMLElement;

  it("tilts towards the pointer by at most 8 degrees on a fine pointer, and shifts the waves", () => {
    stubBrowser((q) => q.includes("pointer: fine"));
    stubRaf();
    renderWhy();
    const el = firstCard();
    el.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 300,
      height: 500,
      right: 300,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON() {},
    });
    fireEvent.pointerEnter(el, { pointerType: "mouse" });
    fireEvent.pointerMove(el, {
      clientX: 300,
      clientY: 0,
      pointerType: "mouse",
    });
    expect(el).toHaveAttribute("data-hover", "true");
    expect(
      Number.parseFloat(el.style.getPropertyValue("--why-rx")),
    ).toBeCloseTo(-8);
    expect(
      Number.parseFloat(el.style.getPropertyValue("--why-ry")),
    ).toBeCloseTo(-8);
    expect(el.style.getPropertyValue("--why-tx")).toBe("0.5");
    fireEvent.pointerLeave(el, { pointerType: "mouse" });
    expect(el).not.toHaveAttribute("data-hover");
    expect(el.style.getPropertyValue("--why-rx")).toBe("0deg");
  });

  it("does not tilt on screens up to 640px wide", () => {
    stubBrowser(
      (q) => q.includes("pointer: fine") || q.includes("max-width: 640px"),
    );
    stubRaf();
    renderWhy();
    const el = firstCard();
    fireEvent.pointerMove(el, {
      clientX: 300,
      clientY: 0,
      pointerType: "mouse",
    });
    expect(el.style.getPropertyValue("--why-rx")).toBe("");
  });

  it("does not tilt when motion is reduced", () => {
    stubBrowser(
      (q) =>
        q.includes("pointer: fine") || q.includes("prefers-reduced-motion"),
    );
    stubRaf();
    renderWhy();
    const el = firstCard();
    fireEvent.pointerMove(el, {
      clientX: 300,
      clientY: 0,
      pointerType: "mouse",
    });
    expect(el.style.getPropertyValue("--why-rx")).toBe("");
  });
});
