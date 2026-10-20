import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScrollEnhancement } from "@/components/fx/use-scroll-enhancement";

const effects = vi.hoisted(() => ({
  attachBeam: vi.fn(),
  attachWords: vi.fn(),
}));
vi.mock("@/components/fx/scroll-enhancements", () => effects);

function Example({ reduced = false }: { reduced?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollEnhancement(ref, "beam", reduced);
  return <div ref={ref}>The complete section remains visible</div>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("deferred native scroll enhancement", () => {
  function observer() {
    let callback: IntersectionObserverCallback = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    return {
      disconnect,
      enter: () =>
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        ),
    };
  }

  it("leaves content rendered while waiting, then attaches once near the viewport", async () => {
    const io = observer();
    const stop = vi.fn();
    effects.attachBeam.mockReturnValue(stop);
    const view = render(<Example />);
    expect(
      view.getByText("The complete section remains visible"),
    ).toBeVisible();
    expect(effects.attachBeam).not.toHaveBeenCalled();
    await act(async () => {
      io.enter();
    });
    expect(effects.attachBeam).toHaveBeenCalledOnce();
    view.unmount();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("does not attach in reduced motion", () => {
    observer();
    render(<Example reduced />);
    expect(effects.attachBeam).not.toHaveBeenCalled();
  });

  it("cancels a pending attachment when motion is turned off", async () => {
    const io = observer();
    const view = render(<Example />);
    await act(async () => {
      io.enter();
      view.rerender(<Example reduced />);
    });
    // Whether the cached module resolved before the update or afterwards, no live effect may remain.
    expect(io.disconnect).toHaveBeenCalled();
    view.unmount();
  });
});
