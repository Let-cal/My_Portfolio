import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { FigureViewer } from "@/components/sections/case-study/figures/FigureViewer";
import type { FigureView } from "@/lib/figures/view";

const CATEGORIES = [
  "screen",
  "architecture",
  "screen",
  "erd",
  "screen",
  "flow",
] as const;
const KANJI = { screen: "画", architecture: "構", erd: "表", flow: "流" };

/** Six 2000x1000 figures: in the 1000x800 canvas below the fit is 50%. */
const figures: FigureView[] = CATEGORIES.map((category, i) => {
  const n = i + 1;
  const diagram = category !== "screen";
  return {
    id: `fig-${n}`,
    kind: diagram ? "diagram" : "image",
    category,
    kanji: KANJI[category],
    caption: `Caption ${n}`,
    note: n === 2 ? "Note two" : null,
    alt: `Alt ${n}`,
    width: 2000,
    height: 1000,
    src: diagram ? `/fig/${n}-light.svg` : `/fig/${n}.webp`,
    srcDark: diagram ? `/fig/${n}-dark.svg` : null,
  };
});

const BOXES: Record<string, { w: number; h: number }> = {
  "data-canvas": { w: 1000, h: 800 },
  "data-minimap": { w: 120, h: 60 },
};

function Harness({
  initial = 0,
  theme = "light",
  onClose = () => {},
  onIndexChange = () => {},
}: {
  initial?: number;
  theme?: "light" | "dark";
  onClose?: () => void;
  onIndexChange?: (i: number) => void;
}) {
  const [index, setIndex] = useState(initial);
  return (
    <FigureViewer
      figures={figures}
      index={index}
      open
      onIndexChange={(i) => {
        onIndexChange(i);
        setIndex(i);
      }}
      onClose={onClose}
      title="SitePlus"
      theme={theme}
    />
  );
}

function renderViewer(props: Parameters<typeof Harness>[0] = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Harness {...props} />
    </NextIntlClientProvider>,
  );
}

const canvas = () => screen.getByRole("group", { name: "Figure canvas" });
const zoomLabel = () => screen.getByTestId("zoom-level");
const button = (name: string | RegExp) => screen.getByRole("button", { name });
/** The zoom layer's transform as numbers: translate x, y and scale. */
function transform() {
  const layer = document.querySelector<HTMLElement>("[data-zoom-layer]")!;
  const m = layer.style.transform.match(
    /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/,
  );
  if (!m) throw new Error(`no transform: ${layer.style.transform}`);
  return { x: Number(m[1]), y: Number(m[2]), scale: Number(m[3]) };
}

beforeEach(() => {
  document.documentElement.dataset.motion = "reduced";
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      for (const [attr, box] of Object.entries(BOXES))
        if (this.hasAttribute(attr))
          return DOMRect.fromRect({ x: 0, y: 0, width: box.w, height: box.h });
      return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
    },
  );
});
afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
});

describe("FigureViewer", () => {
  it("is a modal dialog labelled with the project and caption", () => {
    renderViewer({ initial: 1 });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("SitePlus — Caption 2");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Note two");
    expect(dialog).toHaveTextContent("2 / 6");
    // Focus starts on the canvas, inside the dialog.
    expect(canvas()).toHaveFocus();
  });

  it("shows the rendering that matches the theme", () => {
    renderViewer({ initial: 1, theme: "dark" });
    expect(within(canvas()).getByRole("img")).toHaveAttribute(
      "src",
      "/fig/2-dark.svg",
    );
  });

  it("+ zooms in, - zooms out, 0 fits, 1 shows actual size", async () => {
    const user = userEvent.setup();
    renderViewer();
    expect(zoomLabel()).toHaveTextContent("50%");
    await user.click(button("Zoom in"));
    expect(zoomLabel()).toHaveTextContent("60%");
    await user.click(button("Zoom out"));
    expect(zoomLabel()).toHaveTextContent("50%");
    await user.click(button(/Actual size/));
    expect(zoomLabel()).toHaveTextContent("100%");
    await user.click(button("Fit"));
    expect(zoomLabel()).toHaveTextContent("50%");

    canvas().focus();
    await user.keyboard("+");
    expect(zoomLabel()).toHaveTextContent("60%");
    await user.keyboard("+");
    expect(zoomLabel()).toHaveTextContent("72%");
    await user.keyboard("-");
    expect(zoomLabel()).toHaveTextContent("60%");
    await user.keyboard("1");
    expect(zoomLabel()).toHaveTextContent("100%");
    await user.keyboard("0");
    expect(zoomLabel()).toHaveTextContent("50%");
    // Never below fit, never above 400%.
    await user.keyboard("-");
    expect(zoomLabel()).toHaveTextContent("50%");
    for (let i = 0; i < 12; i++) await user.keyboard("+");
    expect(zoomLabel()).toHaveTextContent("400%");
  });

  it("the wheel zooms at the pointer by 1.2 per notch, double-click toggles fit and 100%", () => {
    renderViewer();
    fireEvent.wheel(canvas(), { deltaY: -100, clientX: 500, clientY: 400 });
    expect(zoomLabel()).toHaveTextContent("60%");
    fireEvent.wheel(canvas(), { deltaY: 100, clientX: 500, clientY: 400 });
    expect(zoomLabel()).toHaveTextContent("50%");
    fireEvent.doubleClick(canvas(), { clientX: 500, clientY: 400 });
    expect(zoomLabel()).toHaveTextContent("100%");
    fireEvent.doubleClick(canvas(), { clientX: 500, clientY: 400 });
    expect(zoomLabel()).toHaveTextContent("50%");
  });

  it("the pan buttons appear only when zoomed beyond fit and move the view", async () => {
    const user = userEvent.setup();
    renderViewer();
    for (const name of ["Pan left", "Pan right", "Pan up", "Pan down"])
      expect(screen.queryByRole("button", { name })).toBeNull();
    await user.click(button(/Actual size/));
    // 100%: the 2000x1000 figure is centred on the 1000x800 canvas.
    expect(transform()).toEqual({ x: -500, y: -100, scale: 1 });
    await user.click(button("Pan right"));
    expect(transform().x).toBeLessThan(-500);
    await user.click(button("Pan left"));
    await user.click(button("Pan left"));
    expect(transform().x).toBeGreaterThan(-500);
    await user.click(button("Pan down"));
    expect(transform().y).toBeLessThan(-100);
    await user.click(button("Pan up"));
    await user.click(button("Pan up"));
    expect(transform().y).toBeGreaterThan(-100);
    await user.click(button("Fit"));
    expect(screen.queryByRole("button", { name: "Pan left" })).toBeNull();
  });

  it("when zoomed, arrow keys pan and PageDown changes figure; at fit, ArrowRight changes figure", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    renderViewer({ onIndexChange });
    canvas().focus();
    await user.keyboard("{ArrowRight}");
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "SitePlus — Caption 2",
    );
    await user.keyboard("{ArrowLeft}");
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    expect(onIndexChange).toHaveBeenCalledTimes(2);

    await user.keyboard("1");
    const before = transform();
    await user.keyboard("{ArrowRight}");
    expect(transform().x).toBeLessThan(before.x);
    await user.keyboard("{ArrowDown}");
    expect(transform().y).toBeLessThan(before.y);
    expect(onIndexChange).toHaveBeenCalledTimes(2);
    await user.keyboard("{PageDown}");
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    // A new figure opens fitted.
    expect(zoomLabel()).toHaveTextContent("50%");
    await user.keyboard("{PageUp}");
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
  });

  it("the previous and next buttons change figure", async () => {
    const user = userEvent.setup();
    renderViewer({ initial: 2 });
    await user.click(button("Next figure"));
    expect(screen.getByRole("dialog")).toHaveTextContent("4 / 6");
    await user.click(button("Previous figure"));
    await user.click(button("Previous figure"));
    expect(screen.getByRole("dialog")).toHaveTextContent("2 / 6");
  });

  it("the index lists categories with counts and moves to a figure", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    renderViewer({ onIndexChange });
    const index = screen.getByRole("navigation", { name: "Figure index" });
    expect(index).toHaveTextContent("SitePlus · 6 figures");
    for (const name of [
      "Screens · 3",
      "Architecture · 1",
      "Data model · 1",
      "Flow · 1",
    ])
      expect(within(index).getByRole("button", { name })).toBeInTheDocument();
    // The current figure is marked.
    expect(
      within(index).getByRole("button", { name: "Caption 1" }),
    ).toHaveAttribute("aria-current", "true");
    await user.click(within(index).getByRole("button", { name: "Caption 5" }));
    expect(onIndexChange).toHaveBeenLastCalledWith(4);
    expect(
      within(index).getByRole("button", { name: "Caption 5" }),
    ).toHaveAttribute("aria-current", "true");
    // A category moves to its first figure.
    await user.click(
      within(index).getByRole("button", { name: "Data model · 1" }),
    );
    expect(onIndexChange).toHaveBeenLastCalledWith(3);
  });

  it("the minimap appears only when zoomed beyond fit and a click on it moves the view", async () => {
    const user = userEvent.setup();
    renderViewer();
    expect(document.querySelector("[data-minimap]")).toBeNull();
    await user.click(button(/Actual size/));
    const minimap = document.querySelector<HTMLElement>("[data-minimap]")!;
    expect(minimap).not.toBeNull();
    // The visible part (the middle half of the width) is drawn in it.
    const frame = minimap.querySelector<HTMLElement>("[data-minimap-view]")!;
    expect(frame.style.left).toBe("25%");
    expect(frame.style.width).toBe("50%");
    // A click on the top-left corner moves the view there.
    fireEvent.click(minimap, { clientX: 0, clientY: 0 });
    expect(transform()).toEqual({ x: 0, y: 0, scale: 1 });
    expect(frame.style.left).toBe("0%");
  });

  it("Esc calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderViewer({ onClose });
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the close button calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderViewer({ onClose });
    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("every control has an accessible name", async () => {
    const user = userEvent.setup();
    renderViewer();
    await user.click(button(/Actual size/));
    const buttons = within(screen.getByRole("dialog")).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(10);
    for (const b of buttons) expect(b).toHaveAccessibleName();
  });
});
