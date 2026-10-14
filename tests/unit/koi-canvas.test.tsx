import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme } from "@/components/site/theme";
import { setMotionPreference } from "@/components/site/motion-preference";
import { KoiCanvas } from "@/scene/KoiCanvas";
import { sceneStore } from "@/scene/store";
import { detectWebGL } from "@/scene/tier";

// useRole() lives in RoleProvider, which imports the routing helpers; the context default (fullstack) is all this test needs.
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/en" }));
vi.mock("@/scene/tier", async (orig) => ({ ...(await orig<typeof import("@/scene/tier")>()), detectWebGL: vi.fn(() => true) }));
// Stands in for the real three.js scene so the test never needs WebGL.
const sceneFault = vi.hoisted(() => ({ throwOnRender: false }));
vi.mock("@/scene/SceneRoot", () => ({
  default: function FakeSceneRoot({ tier, onReadyChange }: { tier: string; onReadyChange: (r: boolean) => void }) {
    if (sceneFault.throwOnRender) throw new Error("renderer creation failed");
    return <canvas data-testid="scene" data-tier={tier} ref={() => onReadyChange(true)} />;
  },
}));

const img = () => document.querySelector<HTMLImageElement>("img[data-koi-fallback]");
const settle = () => new Promise((r) => setTimeout(r, 60));
const raf = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number;

function setCores(n: number) {
  Object.defineProperty(navigator, "hardwareConcurrency", { value: n, configurable: true });
}
function define(key: "innerWidth" | "innerHeight" | "scrollY", value: number) {
  Object.defineProperty(window, key, { value, configurable: true });
}

beforeEach(() => {
  setCores(8);
  localStorage.clear();
  document.documentElement.className = "dark";
  setMotionPreference("on");
  sceneStore.reset();
  sceneFault.throwOnRender = false;
  vi.mocked(detectWebGL).mockReturnValue(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  setMotionPreference("system");
  define("scrollY", 0);
});

describe("KoiCanvas", () => {
  it("shows the night koi image first, fixed behind the content and inert", async () => {
    render(<KoiCanvas />);
    await waitFor(() => expect(img()).not.toBeNull());
    const el = img()!;
    expect(el).toHaveAttribute("src", "/fallback/koi-night.jpg");
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.style).toMatchObject({ position: "fixed", objectFit: "cover", opacity: "0.6", pointerEvents: "none" });
    expect(el.style.zIndex).toBe("-1");
    expect(el.parentElement).toBe(document.body);
    expect(el).toHaveClass("print:hidden");
  });

  it("loads the scene after the page has loaded, then fades the image out", async () => {
    render(<KoiCanvas />);
    const scene = await screen.findByTestId("scene");
    expect(scene).toHaveAttribute("data-tier", "high");
    expect(scene.parentElement).toHaveStyle({ position: "fixed", zIndex: "-1", pointerEvents: "none" });
    await waitFor(() => expect(img()!.style.opacity).toBe("0"));
    expect(sceneStore.getState().tier).toBe("high");
  });

  it("uses the low tier on 4 cores or fewer", async () => {
    setCores(4);
    render(<KoiCanvas />);
    expect(await screen.findByTestId("scene")).toHaveAttribute("data-tier", "low");
  });

  it("follows the theme: day image on the light theme", async () => {
    render(<KoiCanvas />);
    await waitFor(() => expect(img()).not.toBeNull());
    act(() => applyTheme("light"));
    await waitFor(() => expect(img()).toHaveAttribute("src", "/fallback/koi-day.jpg"));
    expect(sceneStore.getState().theme).toBe("light");
  });

  describe("with reduced motion (tier off)", () => {
    beforeEach(() => setMotionPreference("off"));

    it("renders no canvas and keeps the static image", async () => {
      render(<KoiCanvas />);
      await waitFor(() => expect(img()).not.toBeNull());
      await settle(); // the load gate has opened by now; the scene must still not mount
      expect(screen.queryByTestId("scene")).toBeNull();
      expect(document.querySelector("canvas")).toBeNull();
      expect(img()!.style.opacity).toBe("0.6");
      expect(sceneStore.getState().tier).toBe("off");
    });

    it("swaps to the dragon image from chapter 5 and back", async () => {
      render(<KoiCanvas />);
      await waitFor(() => expect(img()).toHaveAttribute("src", "/fallback/koi-night.jpg"));
      act(() => sceneStore.setState({ chapter: 4 }));
      expect(img()).toHaveAttribute("src", "/fallback/koi-night.jpg");
      act(() => sceneStore.setState({ chapter: 5 }));
      expect(img()).toHaveAttribute("src", "/fallback/dragon-night.jpg");
      act(() => sceneStore.setState({ chapter: 6 }));
      expect(img()).toHaveAttribute("src", "/fallback/dragon-night.jpg");
      act(() => sceneStore.setState({ chapter: 3 }));
      expect(img()).toHaveAttribute("src", "/fallback/koi-night.jpg");
    });

    it("uses dragon-day on the light theme", async () => {
      applyTheme("light");
      render(<KoiCanvas />);
      await waitFor(() => expect(img()).not.toBeNull());
      act(() => sceneStore.setState({ chapter: 5 }));
      expect(img()).toHaveAttribute("src", "/fallback/dragon-day.jpg");
    });
  });

  it("re-evaluates the tier live when the Motion toggle changes", async () => {
    render(<KoiCanvas />);
    await screen.findByTestId("scene");
    act(() => setMotionPreference("off"));
    await waitFor(() => expect(screen.queryByTestId("scene")).toBeNull());
    await waitFor(() => expect(img()!.style.opacity).toBe("0.6"));
    act(() => setMotionPreference("on"));
    expect(await screen.findByTestId("scene")).toBeInTheDocument();
  });

  it("without WebGL there is no canvas", async () => {
    vi.mocked(detectWebGL).mockReturnValue(false);
    render(<KoiCanvas />);
    await waitFor(() => expect(img()).not.toBeNull());
    await settle();
    expect(screen.queryByTestId("scene")).toBeNull();
  });
});

describe("KoiCanvas failure handling", () => {
  it("a scene that throws leaves the page and the fallback image in place, and warns once", async () => {
    sceneFault.throwOnRender = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {}); // React logs caught render errors
    render(
      <>
        <p>page content</p>
        <KoiCanvas />
      </>,
    );
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    await settle();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.queryByTestId("scene")).toBeNull();
    expect(document.querySelector("canvas")).toBeNull();
    expect(img()).not.toBeNull();
    expect(img()!.style.opacity).toBe("0.6");
    expect(sceneStore.getState().tier).toBe("off");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    error.mockRestore();
  });
});

describe("KoiCanvas mobile loading", () => {
  it("scrolling alone does not load the scene; the first touch does", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    render(<KoiCanvas />);
    await waitFor(() => expect(img()).not.toBeNull());
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await settle();
    expect(screen.queryByTestId("scene")).toBeNull();
    act(() => {
      window.dispatchEvent(new Event("touchstart"));
    });
    expect(await screen.findByTestId("scene")).toHaveAttribute("data-tier", "low");
  });
});

describe("KoiCanvas input tracking", () => {
  it("writes chapter and t into the store on scroll", async () => {
    const tops = { hero: 0, experience: 1000, projects: 2000, skills: 3000, certificates: 4000, why: 5000, contact: 6000 };
    const sections = Object.entries(tops).map(([id, top]) => {
      const el = document.createElement("section");
      el.id = id;
      el.getBoundingClientRect = () => ({ top: top - window.scrollY }) as DOMRect;
      document.body.append(el);
      return el;
    });
    vi.stubGlobal("requestAnimationFrame", raf);
    define("innerHeight", 800);
    render(<KoiCanvas />);
    await waitFor(() => expect(img()).not.toBeNull());
    define("scrollY", 5400);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => expect(sceneStore.getState().chapter).toBe(5));
    // Chapter 5 runs from scrollY 4600 (its top at the middle of the viewport) to 5600 (the next one's).
    expect(sceneStore.getState().t).toBeCloseTo(0.8, 6);
    sections.forEach((s) => s.remove());
  });

  it("stores the pointer only over a water zone or in chapter 0", async () => {
    vi.stubGlobal("requestAnimationFrame", raf);
    define("innerWidth", 1000);
    define("innerHeight", 800);
    const zone = document.createElement("div");
    zone.setAttribute("data-water-zone", "");
    const other = document.createElement("div");
    document.body.append(zone, other);
    render(<KoiCanvas />);
    await waitFor(() => expect(sceneStore.getState().tier).toBe("high"));
    const move = (el: Element, clientX: number, clientY: number) =>
      act(() => {
        el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX, clientY }));
      });

    // Chapter 0: anywhere counts.
    move(other, 500, 200);
    await waitFor(() => expect(sceneStore.getState().pointer).toEqual({ x: 0, y: 0.5 }));

    // Chapter 3: only the water zone.
    act(() => sceneStore.setState({ chapter: 3 }));
    move(other, 250, 200);
    await waitFor(() => expect(sceneStore.getState().pointer).toBeNull());
    move(zone, 1000, 0);
    await waitFor(() => expect(sceneStore.getState().pointer).toEqual({ x: 1, y: 1 }));
    // Leaving the page (or losing focus) clears it, even over the water.
    move(zone, 500, 400);
    await waitFor(() => expect(sceneStore.getState().pointer).not.toBeNull());
    act(() => {
      document.documentElement.dispatchEvent(new Event("pointerleave"));
    });
    expect(sceneStore.getState().pointer).toBeNull();
    move(zone, 500, 400);
    await waitFor(() => expect(sceneStore.getState().pointer).not.toBeNull());
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(sceneStore.getState().pointer).toBeNull();
    zone.remove();
    other.remove();
  });
});
