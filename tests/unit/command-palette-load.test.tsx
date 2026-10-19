import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chunk = vi.hoisted(() => ({ fail: true, attempts: 0 }));

// Stands in for the palette's lazily loaded chunk: the factory throws while `chunk.fail` is set, which rejects the
// dynamic import() exactly like a stale or offline chunk would.
vi.mock("@/components/site/CommandPaletteDialog", () => {
  chunk.attempts += 1;
  if (chunk.fail) throw new Error("Loading chunk failed");
  return {
    CommandPaletteDialog: ({ initialOpen }: { initialOpen?: boolean }) => (
      <div role="dialog" data-open={String(initialOpen)} />
    ),
  };
});

import { CommandPalette } from "@/components/site/CommandPalette";

const CV = { fullstack: "", techlead: "", pm: "" };
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

beforeEach(() => {
  chunk.fail = true;
  chunk.attempts = 0;
  unhandled.length = 0;
  process.on("unhandledRejection", onUnhandled);
});
afterEach(() => {
  process.off("unhandledRejection", onUnhandled);
});

const settle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));

describe("CommandPalette when its chunk fails to load", () => {
  it("does not crash the page, and the next open tries again", async () => {
    render(
      <>
        <p>page content</p>
        <CommandPalette cvUrls={CV} email="me@example.com" />
      </>,
    );

    act(() => {
      window.dispatchEvent(new Event("open-command"));
    });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(chunk.attempts).toBeGreaterThan(0);

    chunk.fail = false;
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByRole("dialog")).toHaveAttribute(
      "data-open",
      "true",
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(unhandled).toEqual([]);
  });

  it("does not leave an unhandled rejection when the idle warm-up fails", async () => {
    vi.useFakeTimers();
    try {
      render(<CommandPalette cvUrls={CV} email="me@example.com" />);
      await vi.advanceTimersByTimeAsync(5000);
    } finally {
      vi.useRealTimers();
    }
    await settle();
    expect(unhandled).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
