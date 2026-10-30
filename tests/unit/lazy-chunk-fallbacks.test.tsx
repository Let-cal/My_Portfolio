import { render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import seed from "@/content/seed.json";
import { contentSchema, type Content } from "@/content/schema";
import { stubIntersectionObserver } from "../helpers/io-stub";

// A lazy chunk that fails to load (offline, a stale deploy): both imports reject.
vi.mock("@/components/sections/experience/JourneyTimeline", () => {
  throw new Error("Loading chunk failed");
});
vi.mock("@/components/sections/case-study/CaseStudyPanel", () => {
  throw new Error("Loading chunk failed");
});
// What the App Router's next/dynamic does: React.lazy inside Suspense, with no catch around the loader. (Under
// vitest `next/dynamic` resolves to the Pages Router loader, which swallows a failed import.)
vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (loader: () => Promise<unknown>) => {
      const Lazy = React.lazy(() =>
        loader().then((m) => ({
          default: (m && typeof m === "object" && "default" in m
            ? m.default
            : m) as React.ComponentType,
        })),
      );
      return (props: object) =>
        React.createElement(
          React.Suspense,
          { fallback: null },
          React.createElement(Lazy, props),
        );
    },
  };
});
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/en",
}));

import { Experience } from "@/components/sections/Experience";
import { LazyCaseStudyPanel } from "@/components/sections/case-study/LazyCaseStudyPanel";
import { RoleProvider } from "@/components/site/RoleProvider";

const base: Content = contentSchema.parse(seed);
const assign = vi.fn();

beforeEach(() => {
  stubIntersectionObserver();
  assign.mockClear();
  window.history.replaceState(null, "", "/en");
  try {
    window.sessionStorage.clear();
  } catch {
    /* storage unavailable */
  }
  // jsdom cannot navigate: a view of the real location whose assign() is recorded instead.
  const real = window.location;
  vi.stubGlobal(
    "location",
    new Proxy({} as Location, {
      get(_, key) {
        if (key === "assign") return assign;
        const value = Reflect.get(real, key, real);
        return typeof value === "function" ? value.bind(real) : value;
      },
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <RoleProvider>{node}</RoleProvider>
  </NextIntlClientProvider>
);

const panelProps = {
  items: [],
  openId: "skg-coa",
  context: "archive" as const,
  onOpenChange: () => {},
  returnFocusRef: { current: null },
};

describe("a lazy chunk that fails to load", () => {
  it("keeps the Gantt slot and the rest of the tree when the Gantt import rejects", async () => {
    render(wrap(<Experience content={base} locale="en" />));
    // Looked up afresh each time: a crashed page leaves detached nodes behind.
    const slot = () => document.querySelector("#exp-skg-software .jt-slot");
    await waitFor(() => expect(slot()).toBeInTheDocument());
    // React retries a rejected lazy import after its Suspense throttle (~300-500 ms): wait past it, then check the
    // page is still there.
    await new Promise((r) => setTimeout(r, 800));
    expect(slot()).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /SKG Software/ })).toBeNull();
    expect(
      within(document.getElementById("tree-skg-ai-agent")!).getByRole(
        "button",
        { name: /AI Agent/ },
      ),
    ).toBeInTheDocument();
  });

  it("reloads on the deep link when the panel import rejects", async () => {
    window.history.replaceState(null, "", "/en/projects?x=1#top");
    render(wrap(<LazyCaseStudyPanel {...panelProps} />));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const target = new URL(assign.mock.calls[0][0] as string, "http://x");
    expect(target.pathname).toBe("/en/projects");
    expect(target.searchParams.get("case")).toBe("skg-coa");
    expect(target.searchParams.get("x")).toBe("1");
    expect(target.hash).toBe("#top");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not reload twice for the same project (no reload loop)", async () => {
    const first = render(wrap(<LazyCaseStudyPanel {...panelProps} />));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    first.unmount();
    render(wrap(<LazyCaseStudyPanel {...panelProps} />));
    await new Promise((r) => setTimeout(r, 100));
    expect(assign).toHaveBeenCalledTimes(1);
  });
});
