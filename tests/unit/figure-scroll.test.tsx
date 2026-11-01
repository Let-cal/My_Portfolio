import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { FigureScroll } from "@/components/sections/case-study/figures/FigureScroll";
import type { FigureView } from "@/lib/figures/view";
import type { FigureViewerProps } from "@/components/sections/case-study/figures/FigureViewer";

// The viewer is its own chunk (figure-viewer.test.tsx covers it); here a stand-in records how it is opened.
const viewerProps = vi.hoisted(() => ({
  last: null as FigureViewerProps | null,
}));
vi.mock("@/components/sections/case-study/figures/LazyFigureViewer", () => ({
  LazyFigureViewer: (props: FigureViewerProps) => {
    viewerProps.last = props;
    return props.open ? (
      <div data-testid="viewer" data-index={props.index}>
        <button
          type="button"
          onClick={() => props.onIndexChange(props.index + 1)}
        >
          viewer next
        </button>
        <button
          type="button"
          onClick={() => {
            props.onClose();
            props.returnFocusRef?.current?.focus();
          }}
        >
          viewer close
        </button>
      </div>
    ) : null;
  },
}));

/** Six figures: images and diagrams, the second one a diagram with light and dark renderings. */
const figures: FigureView[] = Array.from({ length: 6 }, (_, i) => {
  const n = i + 1;
  const diagram = i % 2 === 1;
  return {
    id: `fig-${n}`,
    kind: diagram ? "diagram" : "image",
    category: diagram ? "architecture" : "screen",
    kanji: diagram ? "構" : "画",
    caption: `Caption ${n}`,
    note: n === 2 ? "Note two" : null,
    alt: `Alt ${n}`,
    width: 800,
    height: 500,
    src: diagram ? `/fig/${n}-light.svg` : `/fig/${n}.webp`,
    srcDark: diagram ? `/fig/${n}-dark.svg` : null,
  };
});

function Harness({
  initial = 0,
  theme = "light",
}: {
  initial?: number;
  theme?: "light" | "dark";
}) {
  const [index, setIndex] = useState(initial);
  return (
    <FigureScroll
      figures={figures}
      index={index}
      onIndexChange={setIndex}
      title="SitePlus"
      theme={theme}
    />
  );
}

function renderScroll(props: Parameters<typeof Harness>[0] = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Harness {...props} />
    </NextIntlClientProvider>,
  );
}

const stage = () => screen.getByRole("tabpanel");
const tabs = () => screen.getAllByRole("tab");

beforeEach(() => {
  document.documentElement.dataset.motion = "reduced";
});
afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
});

describe("FigureScroll", () => {
  it("the filmstrip is a tablist with one tab per figure and roving tabindex", () => {
    renderScroll({ initial: 1 });
    const list = screen.getByRole("tablist");
    const all = within(list).getAllByRole("tab");
    expect(all).toHaveLength(6);
    expect(all.map((t) => t.getAttribute("tabindex"))).toEqual([
      "-1",
      "0",
      "-1",
      "-1",
      "-1",
      "-1",
    ]);
    expect(all[1]).toHaveAttribute("aria-selected", "true");
    expect(all[0]).toHaveAttribute("aria-selected", "false");
    // Each tab is named by its caption and controls the stage, which it labels.
    expect(all[1]).toHaveAccessibleName("Caption 2");
    expect(all[1]).toHaveAttribute("aria-controls", stage().id);
    expect(stage()).toHaveAttribute("aria-labelledby", all[1].id);
    expect(within(stage()).getByRole("img", { name: "Alt 2" })).toBeVisible();
    // Position label and the category seal on the stage.
    expect(screen.getByText("2 / 6")).toBeInTheDocument();
    expect(screen.getByText("Architecture")).toBeInTheDocument();
  });

  it("ArrowRight and ArrowLeft change the figure, Home and End jump", async () => {
    const user = userEvent.setup();
    renderScroll();
    tabs()[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[1]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tabs()[2]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(tabs()[5]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[5]).toHaveFocus();
    // No wrap at the ends.
    await user.keyboard("{ArrowRight}");
    expect(tabs()[5]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
  });

  it("the side buttons move one figure and are disabled at the ends", async () => {
    const user = userEvent.setup();
    renderScroll();
    const prev = screen.getByRole("button", { name: "Previous figure" });
    const next = screen.getByRole("button", { name: "Next figure" });
    expect(prev).toHaveAttribute("aria-disabled", "true");
    await user.click(next);
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(prev).not.toHaveAttribute("aria-disabled", "true");
    await user.click(prev);
    await user.click(prev);
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
  });

  it("announces Figure 2 of 6 and the caption in a live region", async () => {
    const user = userEvent.setup();
    renderScroll();
    await user.click(tabs()[1]);
    const live = screen.getByText("Figure 2 of 6: Caption 2");
    expect(live).toHaveAttribute("aria-live", "polite");
    // Caption and note under the stage.
    expect(screen.getByText("Note two")).toBeInTheDocument();
  });

  it("shows the dark rendering of a diagram in the dark theme and never requests the light one", () => {
    renderScroll({ initial: 1, theme: "dark" });
    const sources = Array.from(document.querySelectorAll("img")).map((img) =>
      img.getAttribute("src"),
    );
    expect(sources).toContain("/fig/2-dark.svg");
    expect(sources.some((s) => s?.includes("-light.svg"))).toBe(false);
    expect(within(stage()).getByRole("img")).toHaveAttribute(
      "src",
      "/fig/2-dark.svg",
    );
  });

  it("shows the light rendering in the light theme", () => {
    renderScroll({ initial: 1, theme: "light" });
    expect(within(stage()).getByRole("img")).toHaveAttribute(
      "src",
      "/fig/2-light.svg",
    );
    const sources = Array.from(document.querySelectorAll("img")).map((img) =>
      img.getAttribute("src"),
    );
    expect(sources.some((s) => s?.includes("-dark.svg"))).toBe(false);
  });

  it("only the current figure loads eagerly, with explicit width and height", () => {
    renderScroll();
    const current = within(stage()).getByRole("img");
    expect(current).not.toHaveAttribute("loading", "lazy");
    expect(current).toHaveAttribute("width", "800");
    expect(current).toHaveAttribute("height", "500");
    const thumbs = screen
      .getByRole("tablist")
      .querySelectorAll<HTMLImageElement>("img");
    expect(thumbs).toHaveLength(6);
    for (const img of thumbs) expect(img).toHaveAttribute("loading", "lazy");
  });

  it("an image that fails to load shows the error and Retry, and Retry reloads it", async () => {
    const user = userEvent.setup();
    renderScroll();
    const img = within(stage()).getByRole("img");
    fireEvent.error(img);
    expect(
      within(stage()).getByText("Could not load this figure"),
    ).toBeInTheDocument();
    expect(within(stage()).queryByRole("img")).toBeNull();
    // The rest of the view keeps working.
    expect(tabs()).toHaveLength(6);
    await user.click(within(stage()).getByRole("button", { name: "Retry" }));
    const again = within(stage()).getByRole("img", { name: "Alt 1" });
    expect(again).not.toBe(img);
    expect(
      within(stage()).queryByText("Could not load this figure"),
    ).toBeNull();
  });

  it("Retry moves focus to the stage, not to the dialog behind it", async () => {
    const user = userEvent.setup();
    renderScroll();
    fireEvent.error(within(stage()).getByRole("img"));
    const retry = within(stage()).getByRole("button", { name: "Retry" });
    retry.focus();
    await user.keyboard("{Enter}");
    expect(within(stage()).getByRole("img", { name: "Alt 1" })).toBeTruthy();
    expect(document.activeElement).toBe(stage());
  });

  it("the caption and the note carry their full text in a title (they may be clamped)", async () => {
    const user = userEvent.setup();
    renderScroll({ initial: 1 });
    const caption = screen.getByText("Caption 2", { selector: "p" });
    const note = screen.getByText("Note two", { selector: "p" });
    expect(caption).toHaveAttribute("title", "Caption 2");
    expect(note).toHaveAttribute("title", "Note two");
    // A figure without a note has no empty tooltip.
    await user.click(tabs()[0]);
    expect(screen.getByText("Caption 1", { selector: "p" })).toHaveAttribute(
      "title",
      "Caption 1",
    );
    expect(document.querySelector("p[title='']")).toBeNull();
  });

  it("rapid presses cancel the running figure transition", async () => {
    document.documentElement.dataset.motion = "full";
    const animations: { cancel: ReturnType<typeof vi.fn> }[] = [];
    const animate = vi.fn(() => {
      const animation = {
        cancel: vi.fn(),
        finished: new Promise<never>(() => {}),
      };
      animations.push(animation);
      return animation as unknown as Animation;
    });
    Object.defineProperty(HTMLElement.prototype, "animate", {
      value: animate,
      configurable: true,
    });
    try {
      renderScroll();
      const next = screen.getByRole("button", { name: "Next figure" });
      act(() => {
        next.click();
      });
      const first = [...animations];
      expect(first.length).toBeGreaterThan(0);
      act(() => {
        next.click();
      });
      // The first transition was cancelled, not queued; one outgoing figure is on screen.
      for (const a of first) expect(a.cancel).toHaveBeenCalled();
      expect(document.querySelectorAll("[data-figure-leaving]")).toHaveLength(
        1,
      );
      expect(tabs()[2]).toHaveAttribute("aria-selected", "true");
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  });

  it("under full motion the old figure drifts, under reduced motion it only fades", () => {
    const keyframes: Keyframe[][] = [];
    Object.defineProperty(HTMLElement.prototype, "animate", {
      value: vi.fn((frames: Keyframe[]) => {
        keyframes.push(frames);
        return {
          cancel: vi.fn(),
          finished: new Promise<never>(() => {}),
        } as unknown as Animation;
      }),
      configurable: true,
    });
    try {
      renderScroll();
      act(() => {
        screen.getByRole("button", { name: "Next figure" }).click();
      });
      expect(keyframes.flat().some((k) => "transform" in k)).toBe(false);
      keyframes.length = 0;
      document.documentElement.dataset.motion = "full";
      act(() => {
        screen.getByRole("button", { name: "Next figure" }).click();
      });
      expect(keyframes.flat().some((k) => "transform" in k)).toBe(true);
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  });

  it("Enter on the stage, Enlarge and a click on the figure open the viewer on the current figure", async () => {
    const user = userEvent.setup();
    viewerProps.last = null;
    renderScroll({ initial: 3 });
    // The viewer chunk is not requested before the first Enlarge.
    expect(viewerProps.last).toBeNull();
    stage().focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("viewer")).toHaveAttribute("data-index", "3");
    expect(viewerProps.last).toMatchObject({
      open: true,
      title: "SitePlus",
      theme: "light",
    });
    await user.click(screen.getByRole("button", { name: "viewer close" }));
    expect(screen.queryByTestId("viewer")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Enlarge" }));
    expect(screen.getByTestId("viewer")).toHaveAttribute("data-index", "3");
    await user.click(screen.getByRole("button", { name: "viewer close" }));
    await user.click(within(stage()).getByRole("img"));
    expect(screen.getByTestId("viewer")).toBeInTheDocument();
  });

  it("the stage follows the viewer and gets focus back when it closes", async () => {
    const user = userEvent.setup();
    renderScroll({ initial: 1 });
    await user.click(screen.getByRole("button", { name: "Enlarge" }));
    await user.click(screen.getByRole("button", { name: "viewer next" }));
    expect(screen.getByTestId("viewer")).toHaveAttribute("data-index", "2");
    await user.click(screen.getByRole("button", { name: "viewer close" }));
    expect(tabs()[2]).toHaveAttribute("aria-selected", "true");
    expect(stage()).toHaveFocus();
  });
});
