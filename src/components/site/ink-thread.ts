/**
 * 墨の糸 Ink thread of the side rail (Emaki spec 5.5): the path builder, the position maths and the scroll engine.
 * The rail's markup is server-rendered; this module is loaded on its own (`import()` when the browser is idle), so
 * none of it is in the initial bundle. No `motion` import: plain DOM and SVG.
 */

const round = (n: number) => Math.round(n * 100) / 100;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** A vertical cubic path through `(x, y)` for every y, swaying `sway` px to alternate sides between items. */
export function buildThreadPath(ys: number[], x: number, sway: number) {
  if (!ys.length) return "";
  let d = `M${round(x)} ${round(ys[0])}`;
  for (let i = 1; i < ys.length; i++) {
    const mid = round((ys[i - 1] + ys[i]) / 2);
    const s = i % 2 ? sway : -sway;
    d += ` C${round(x + s)} ${mid} ${round(x - s)} ${mid} ${round(x)} ${round(ys[i])}`;
  }
  return d;
}

/** The reader's y on the thread: between item `activeIndex` and the next one, by the chapter's progress. */
export function threadPosition(
  ys: number[],
  activeIndex: number,
  progress: number,
) {
  if (!ys.length) return 0;
  const i = Math.min(ys.length - 1, Math.max(0, activeIndex));
  const next = ys[i + 1] ?? ys[i];
  return ys[i] + (next - ys[i]) * clamp01(progress);
}

/** How much of a chapter lies above the reading line, in [0, 1]. */
export function chapterProgress(
  rect: Pick<DOMRectReadOnly, "top" | "height">,
  readingLine: number,
) {
  if (rect.height <= 0) return rect.top <= readingLine ? 1 : 0;
  return clamp01((readingLine - rect.top) / rect.height);
}

/** x of the thread inside its 20 px wide SVG, the sway between items, and the reading line (share of the viewport). */
const X = 10;
const SWAY = 2.5;
const READING_LINE = 0.5;

/**
 * Drives the thread inside `root` (the rail's `[data-ink-root]`):
 * - a ResizeObserver (and `document.fonts.ready`) measures the numerals and rebuilds the path: all reads, then writes;
 * - scroll and resize write `--sp` per item, the accent clip, the drop and `data-dragon` once per animation frame.
 * The active chapter is the link React marked with `aria-current` (`useActiveSection`); call `update` when it changes.
 */
export function attachInkThread(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>("[data-ink-list]");
  const links = [...root.querySelectorAll<HTMLElement>("a[data-chapter]")];
  if (!list || !links.length) return { update() {}, stop() {} };
  const numerals = links.map((a) => a.querySelector("[data-numeral]")!);
  const svgs = root.querySelectorAll("svg[data-ink-svg]");
  const ink = root.querySelector<SVGElement>("[data-ink]");
  const drop = root.querySelector<HTMLElement>("[data-ink-drop]");
  const stops = root.querySelectorAll("[data-ink-stop]");
  const ids = links.map((a) => a.dataset.chapter!);
  const why = ids.indexOf("why");
  let ys: number[] = [];
  let height = 0;
  let frame = 0;

  const flush = () => {
    frame = 0;
    if (!ys.length) return;
    // Reads.
    const line = window.innerHeight * READING_LINE;
    const progress = ids.map((id) => {
      const section = document.getElementById(id);
      return section
        ? chapterProgress(section.getBoundingClientRect(), line)
        : 0;
    });
    const whySection = why < 0 ? null : document.getElementById(ids[why]);
    // Same trigger as the top koi turning into a dragon: #why is in view or above it.
    const dragon =
      !!whySection &&
      whySection.getBoundingClientRect().top < window.innerHeight;
    const active = links.findIndex((a) => a.hasAttribute("aria-current"));
    // Writes.
    links.forEach((a, i) =>
      a.style.setProperty("--sp", progress[i].toFixed(3)),
    );
    root.toggleAttribute("data-dragon", dragon);
    root.toggleAttribute("data-inked", active >= 0);
    if (active < 0) return;
    const y = threadPosition(ys, active, progress[active]);
    if (ink)
      ink.style.clipPath = `inset(0 0 ${round(Math.max(0, height - y))}px 0)`;
    if (drop) drop.style.transform = `translateY(${round(y)}px)`;
  };
  const update = () => {
    if (!frame) frame = requestAnimationFrame(flush);
  };

  const measure = () => {
    // Reads.
    height = list.offsetHeight;
    if (!height) return; // The rail is hidden below 1024 px.
    const top = list.getBoundingClientRect().top;
    ys = numerals.map((n) => {
      const r = n.getBoundingClientRect();
      return round(r.top - top + r.height / 2);
    });
    // Writes.
    const d = buildThreadPath(ys, X, SWAY);
    svgs.forEach((svg) => {
      svg.setAttribute("height", String(height));
      svg.setAttribute("viewBox", `0 0 20 ${height}`);
      svg.querySelector("path")?.setAttribute("d", d);
    });
    // The accent stroke is the role colour down to 第四章 and teal from 第五章 昇龍.
    if (why > 0 && stops.length === 2) {
      stops[0].setAttribute("offset", String(round(ys[why - 1] / height)));
      stops[1].setAttribute("offset", String(round(ys[why] / height)));
      root
        .querySelector("[data-ink-gradient]")
        ?.setAttribute("y2", String(height));
    }
    root.setAttribute("data-ink-ready", "");
    flush();
  };

  const observer = new ResizeObserver(measure);
  observer.observe(list);
  void document.fonts?.ready.then(measure);
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  return {
    update,
    stop() {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    },
  };
}
