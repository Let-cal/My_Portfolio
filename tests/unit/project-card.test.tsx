import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import seed from "@/content/seed.json";
import { contentSchema, type Content, type Locale } from "@/content/schema";
import { Projects } from "@/components/sections/Projects";
import { projectKind } from "@/components/sections/projects/ProjectCard";
import { stubIntersectionObserver } from "../helpers/io-stub";

const base: Content = contentSchema.parse(seed);

function renderProjects(opts: { locale?: Locale; content?: Content } = {}) {
  const locale = opts.locale ?? "en";
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : en}>
      <Projects content={opts.content ?? base} locale={locale} />
    </NextIntlClientProvider>,
  );
}

const card = (id: string) => {
  const node = document.getElementById(`proj-${id}`);
  if (!node) throw new Error(`#proj-${id} not found`);
  return node;
};

const withVideo = (id = "siteplus"): Content => ({
  ...base,
  projects: base.projects.map((p) =>
    p.id === id ? { ...p, videoUrl: "/video/demo.mp4", posterUrl: "/images/demo.jpg" } : p,
  ),
});

const media = (hover: boolean) => (query: string) => ({
  matches: hover && query.includes("hover: hover"),
  media: query,
  addEventListener() {},
  removeEventListener() {},
});

// These tests render sections that contain <Reveal>, whose whileInView needs an IntersectionObserver.
beforeEach(() => stubIntersectionObserver());
afterEach(() => vi.unstubAllGlobals());

describe("Projects bento", () => {
  it("is a section labelled by its heading", () => {
    renderProjects();
    const section = document.getElementById("projects");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByRole("heading", { level: 2, name: "Projects" })).toBeInTheDocument();
  });

  it("gives every published project a #proj-<id> element in sortIndex order, skipping unpublished ones", () => {
    const content: Content = {
      ...base,
      projects: base.projects.map((p) => (p.id === "zodiacgems" ? { ...p, published: false } : p)),
    };
    renderProjects({ content });
    expect(document.getElementById("proj-zodiacgems")).toBeNull();
    const ids = Array.from(document.querySelectorAll("[id^='proj-']")).map((n) => n.id);
    expect(ids).toEqual(["proj-siteplus", "proj-meet-my-lecturer"]);
  });

  it("labels each card with its position and kind: NN · WEB / MOBILE / WEB + MOBILE", () => {
    renderProjects();
    expect(within(card("siteplus")).getByText("01 · WEB + MOBILE")).toBeInTheDocument();
    expect(within(card("zodiacgems")).getByText("02 · WEB + MOBILE")).toBeInTheDocument();
    expect(within(card("meet-my-lecturer")).getByText("03 · WEB")).toBeInTheDocument();
  });

  it("derives MOBILE only for Flutter/Dart and WEB for React/Next.js/Java Servlet", () => {
    expect(projectKind(["Flutter"])).toBe("MOBILE");
    expect(projectKind(["Dart", "Node.js"])).toBe("MOBILE");
    expect(projectKind(["Next.js"])).toBe("WEB");
    expect(projectKind(["React", "Dart"])).toBe("WEB + MOBILE");
    expect(projectKind(["Java Servlet"])).toBe("WEB");
    expect(projectKind(["Python"])).toBeNull();
  });

  it("wraps each card in a glow card with tilt and ends with a tech marquee that pauses on hover", () => {
    renderProjects();
    const siteplus = card("siteplus");
    expect(siteplus).toHaveAttribute("data-glow-card");
    const marquee = siteplus.querySelector(".fx-marquee");
    expect(marquee).not.toBeNull();
    expect(marquee).toHaveAttribute("data-pause-on-hover");
    expect(within(marquee as HTMLElement).getAllByText("Flutter").length).toBeGreaterThan(0);
  });

  it("makes the first card span two columns on desktop", () => {
    renderProjects();
    expect(card("siteplus").className).toMatch(/md:col-span-2/);
    expect(card("zodiacgems").className).not.toMatch(/md:col-span-2/);
  });

  it("shows a placeholder tile with initials and no <video> when there is no video or poster", () => {
    renderProjects();
    const siteplus = card("siteplus");
    expect(siteplus.querySelector("video")).toBeNull();
    const placeholder = siteplus.querySelector("[data-placeholder]");
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveTextContent("SP");
    expect(card("meet-my-lecturer").querySelector("[data-placeholder]")).toHaveTextContent("MML");
  });

  it("shows the poster image and no <video> when only a poster exists", () => {
    const content: Content = {
      ...base,
      projects: base.projects.map((p) => (p.id === "siteplus" ? { ...p, posterUrl: "/images/demo.jpg" } : p)),
    };
    renderProjects({ content });
    expect(card("siteplus").querySelector("video")).toBeNull();
    expect(card("siteplus").querySelector("img")).not.toBeNull();
    expect(card("siteplus").querySelector("[data-placeholder]")).toBeNull();
  });

  it("renders a muted, looping, preload=none video with its poster when videoUrl is set", () => {
    renderProjects({ content: withVideo() });
    const video = card("siteplus").querySelector("video") as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.getAttribute("poster")).toContain("demo.jpg");
    expect(video.getAttribute("src")).toBe("/video/demo.mp4");
    expect(video.hasAttribute("autoplay")).toBe(false);
  });

  describe("video playback", () => {
    let play: ReturnType<typeof vi.fn>;
    let pause: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      play = vi.fn(() => Promise.resolve());
      pause = vi.fn();
      Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
      Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pause });
    });
    afterEach(() => vi.unstubAllGlobals());

    it("plays on pointerenter and pauses on pointerleave (hover devices)", () => {
      vi.stubGlobal("matchMedia", media(true));
      renderProjects({ content: withVideo() });
      fireEvent.pointerEnter(card("siteplus"), { pointerType: "mouse" });
      expect(play).toHaveBeenCalledTimes(1);
      fireEvent.pointerLeave(card("siteplus"), { pointerType: "mouse" });
      expect(pause).toHaveBeenCalledTimes(1);
    });

    it("plays when at least 60% of the card is visible and pauses when it is not (touch devices)", () => {
      vi.stubGlobal("matchMedia", media(false));
      let callback: IntersectionObserverCallback = () => {};
      let options: IntersectionObserverInit | undefined;
      class FakeObserver {
        constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
          // Marquees also observe approach; select the video observer rather than the last observer created.
          if (opts?.threshold === 0.6) {
            callback = cb;
            options = opts;
          }
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      vi.stubGlobal("IntersectionObserver", FakeObserver);
      renderProjects({ content: withVideo() });
      expect(options?.threshold).toBe(0.6);
      const target = card("siteplus");
      const entry = (ratio: number) => [{ isIntersecting: ratio > 0, intersectionRatio: ratio, target }] as unknown as IntersectionObserverEntry[];
      act(() => callback(entry(0.7), {} as IntersectionObserver));
      expect(play).toHaveBeenCalledTimes(1);
      act(() => callback(entry(0.3), {} as IntersectionObserver));
      expect(pause).toHaveBeenCalled();
    });
  });

  it("opens the case study sheet when a card with a case study is clicked", async () => {
    renderProjects();
    await userEvent.click(within(card("siteplus")).getByRole("button", { name: /case study/i }));
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    const cs = base.projects.find((p) => p.id === "siteplus")!.caseStudy!;
    expect(within(dialog).getByText(cs.problem.en)).toBeInTheDocument();
    expect(within(dialog).getByText(cs.result.en)).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not make a card without a case study a dialog trigger", () => {
    renderProjects();
    expect(within(card("zodiacgems")).queryByRole("button")).toBeNull();
    expect(within(card("meet-my-lecturer")).queryByRole("button")).toBeNull();
  });

  it("links Demo and Code when URLs exist, opening in a new tab with a screen-reader cue", () => {
    renderProjects();
    const siteplus = card("siteplus");
    const demo = within(siteplus).getByRole("link", { name: /Demo/ });
    expect(demo).toHaveAttribute("href", "https://site-plus-15hdsvfpr-let-cals-projects.vercel.app/");
    expect(demo).toHaveAttribute("target", "_blank");
    expect(demo).toHaveAttribute("rel", "noopener noreferrer");
    expect(demo).toHaveTextContent("(opens in new tab)");
    expect(within(siteplus).getByRole("link", { name: /Code \(Web\)/ })).toHaveAttribute("href", "https://github.com/Let-cal/SitePlus-FE");
    expect(within(siteplus).getByRole("link", { name: /Code \(Mobile\)/ })).toHaveAttribute("href", "https://github.com/Let-cal/SitePlus-MB");
  });

  it("omits Demo for a project without demoUrl and labels a single repo plain 'Code'", () => {
    renderProjects();
    const meet = card("meet-my-lecturer");
    expect(within(meet).queryByRole("link", { name: /Demo/ })).toBeNull();
    const links = within(meet).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent(/^Code/);
    expect(links[0]).toHaveTextContent(/^Code \(opens in new tab\)$/);
  });

  it("localizes UI strings and content", () => {
    renderProjects({ locale: "ja" });
    const siteplus = card("siteplus");
    expect(within(siteplus).getByText("チームリーダー")).toBeInTheDocument();
    expect(within(siteplus).getByRole("link", { name: new RegExp(ja.projects.demo) })).toBeInTheDocument();
  });
});
