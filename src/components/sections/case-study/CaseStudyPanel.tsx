"use client";

import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ensureToaster } from "@/components/site/toast-readiness";
import { CopyIcon, XIcon } from "@/components/site/icons";
import { useTheme } from "@/components/site/theme";
import {
  figureNumeral,
  parseFigParam,
  stepFigure,
  writeFigParam,
} from "@/lib/figures/nav";
import type { FigureView } from "@/lib/figures/view";
import {
  CASE_PARAM,
  caseReloadKey,
  neighbours,
  type CaseContext,
} from "@/lib/case-list";
import { repoLinks } from "@/lib/repo-links";
import { cn } from "@/lib/utils";
import { LazyFigureScroll } from "./figures/LazyFigureScroll";
import styles from "./kakejiku.module.css";

/** A case study with its text already picked for the current locale. */
export type CaseStudyView = {
  problem: string;
  role: string;
  decisions: string;
  result: string;
};

/** One project the panel can show, every text already picked for the locale. */
export type CaseStudyItem = {
  id: string;
  title: string;
  /** Company group, school or "Personal". */
  where: string;
  /** Short label of the position the project was done in ("Intern", "Software Engineer"); null outside work. */
  stint: string | null;
  role: string;
  teamSize: string | null;
  period: string;
  duration: string;
  /** "Work", "University" or "Personal". */
  kindLabel: string;
  caseStudy: CaseStudyView;
  tech: string[];
  demoUrl: string | null;
  repoUrls: string[];
  /** Public figure views, stored order; empty for a project without figures. */
  figures: FigureView[];
};

type CaseStudyPanelProps = {
  /** Only the items with a case study, in the order of the list the panel was opened from. */
  items: CaseStudyItem[];
  openId: string | null;
  context: CaseContext;
  /** A project id to show (previous / next) or null to close. */
  onOpenChange: (id: string | null) => void;
  /** Gets focus back when the panel closes (the element that opened it). */
  returnFocusRef: RefObject<HTMLElement | null>;
};

/** Viewports where nothing is tried: full screen, one scrolling column (spec 6a.1). */
const SMALL = "(max-width: 1023px), (max-height: 679px)";
const PANES = [
  ["problem", "一"],
  ["role", "二"],
  ["decisions", "三"],
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Which view of the case study is open: the text (content) or the figures, on figure `index` (0-based). */
type View = { figures: boolean; index: number };
const TEXT: View = { figures: false, index: 0 };

/** ←/→ belong to a text field when one has the keypress. */
function inTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
      target.isContentEditable ||
      target.closest("[contenteditable]:not([contenteditable='false'])") !==
        null)
  );
}

/** Trying the shorter wide layout may have clamped the scroll position: put the reader back. */
function keepScroll(content: HTMLElement, top: number) {
  if (content.scrollTop !== top) content.scrollTop = top;
}

/**
 * Wide when the whole case study fits the panel, otherwise (or on a small viewport) the scrolling one-column
 * layout. Written straight to `data-mode` (never rendered by React): reset to wide, read the overflow, set the
 * result, all before paint. Measured on open, on every project change, when the panel's box resizes and whenever
 * web fonts finish loading (`ready`, then each later `loadingdone`, e.g. a Japanese subset used for the first
 * time). A re-measure that ends in the scrolling layout keeps the reader's scroll position.
 */
function useFitMode(
  content: HTMLElement | null,
  itemId: string | null,
  figures: boolean,
) {
  useLayoutEffect(() => {
    const frame = content?.parentElement;
    if (!content || !frame) return;
    const small =
      typeof window.matchMedia === "function" ? window.matchMedia(SMALL) : null;
    const measure = () => {
      if (small?.matches) {
        content.setAttribute("data-mode", "scroll");
        return;
      }
      const top = content.scrollTop;
      content.setAttribute("data-mode", "wide");
      if (content.scrollHeight > content.clientHeight + 1) {
        content.setAttribute("data-mode", "scroll");
        keepScroll(content, top);
      }
    };
    measure();
    content.scrollTo?.(0, 0);
    let alive = true;
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => measure())
        : null;
    observer?.observe(frame);
    small?.addEventListener?.("change", measure);
    const fonts = document.fonts;
    void fonts?.ready.then(() => {
      if (alive) measure();
    });
    fonts?.addEventListener?.("loadingdone", measure);
    return () => {
      alive = false;
      observer?.disconnect();
      small?.removeEventListener?.("change", measure);
      fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [content, itemId, figures]);
}

/**
 * The 掛軸 Kakejiku case study panel (spec 5.4): a centred Radix Dialog (focus trap, Esc, focus back to the
 * opener) mounted like a hanging scroll. Spine with the chapter and position, header with the meta row and the
 * actions, the result banner with its 果 seal, the Problem / Role / Decisions panes, and a footer with every tech
 * chip and the previous / next projects of the list it was opened from (also ←/→ outside text fields).
 *
 * A project with figures gets a Content / Figures toggle (spec 6.1): the figures view takes the grid area of the
 * result banner and the panes, so the fit measure stays one code path. While it is open, the arrow keys move
 * between figures (not projects), the spine shows the figure position and `&fig=` follows the figure. Moving to
 * another project keeps the figures view on its first figure, or falls back to the content when it has none.
 */
export function CaseStudyPanel({
  items,
  openId,
  context,
  onOpenChange,
  returnFocusRef,
}: CaseStudyPanelProps) {
  const t = useTranslations("caseStudy");
  const tp = useTranslations("projects");
  const tc = useTranslations("common");
  const uid = useId();
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  // Keeps the last project on screen while the close animation runs.
  const [shownId, setShownId] = useState(openId);
  if (openId !== null && openId !== shownId) setShownId(openId);

  const item = items.find((i) => i.id === shownId) ?? null;
  const open = openId !== null && item !== null;
  const { prev, next, index, total } = neighbours(
    items.map((i) => i.id),
    shownId ?? "",
  );
  const titleOf = (id: string) => items.find((i) => i.id === id)?.title ?? "";
  const { theme } = useTheme();

  // The view belongs to a project: a fresh open reads `?fig=`, a move keeps the figures view on figure 1 when the
  // new project has figures. `entered` marks a view the visitor switched to (it plays the switch motion).
  const [view, setView] = useState<View>(TEXT);
  const [viewFor, setViewFor] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  if (open && item && viewFor !== item.id) {
    const count = item.figures.length;
    let next = TEXT;
    if (viewFor === null) {
      const fig = parseFigParam(window.location.search, count);
      if (fig !== null) next = { figures: true, index: fig };
    } else if (view.figures && count > 0) next = { figures: true, index: 0 };
    setViewFor(item.id);
    setView(next);
    setEntered(false);
  }
  if (!open && viewFor !== null) setViewFor(null);
  const figureCount = item?.figures.length ?? 0;
  const inFigures = view.figures && figureCount > 0;
  const figIndex = Math.min(view.index, Math.max(figureCount - 1, 0));

  useFitMode(open ? content : null, shownId, inFigures);

  // `&fig=` mirrors the open figure (1-based) and is removed in the content view.
  const figParam = open && inFigures ? figIndex + 1 : null;
  useEffect(() => {
    if (open) writeFigParam(figParam);
  }, [open, shownId, figParam]);

  // The view on screen, for the exit motion of a switch; a newer switch cancels a running one.
  const viewRef = useRef<HTMLDivElement | null>(null);
  const exiting = useRef<Animation[]>([]);
  // A move, a close or unmounting drops a switch still on its way out (its fill would keep the view hidden).
  useEffect(
    () => () => {
      for (const a of exiting.current) a.cancel();
      exiting.current = [];
    },
    [open, shownId],
  );

  // This chunk loaded and the project is on screen: a reload tried for it earlier (LazyCaseStudyPanel) is done.
  useEffect(() => {
    if (!open || shownId === null) return;
    try {
      window.sessionStorage.removeItem(caseReloadKey(shownId));
    } catch {
      // No storage: nothing was set.
    }
  }, [open, shownId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        inTextField(event.target)
      )
        return;
      // In the figures view the arrows belong to the figures (the visitor is looking at them); no wrap, and the
      // projects stay on their own buttons.
      if (inFigures) {
        const delta =
          event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        if (!delta) return;
        event.preventDefault();
        setView((v) => ({
          figures: true,
          index: stepFigure({ index: v.index, count: figureCount }, delta)
            .index,
        }));
        return;
      }
      const to =
        event.key === "ArrowLeft"
          ? prev
          : event.key === "ArrowRight"
            ? next
            : null;
      if (!to) return;
      event.preventDefault();
      onOpenChange(to);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, prev, next, onOpenChange, inFigures, figureCount]);

  if (!item) return null;
  const cs = item.caseStudy;

  async function copyLink(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(CASE_PARAM, id);
    url.hash = "";
    const href = url.href;
    let copied = true;
    try {
      await navigator.clipboard.writeText(href);
    } catch {
      copied = false;
    }
    // Without a clipboard the toast says so and carries the URL itself, so it can still be copied by hand.
    void Promise.all([ensureToaster(), import("sonner")])
      .then(([, { toast }]) =>
        toast(copied ? t("copied") : t("copyFailed"), { description: href }),
      )
      .catch((error: unknown) => {
        console.warn("[case study] copy-link toast failed", error);
      });
  }

  const links = [
    ...(item.demoUrl ? [{ url: item.demoUrl, label: tp("demo") }] : []),
    ...repoLinks(item.repoUrls, tp),
  ];
  const meta = [
    { label: t("role"), value: item.role },
    { label: t("teamLabel"), value: item.teamSize },
    { label: t("period"), value: `${item.period} · ${item.duration}` },
    { label: t("where"), value: item.kindLabel },
  ].filter((m) => m.value);
  const position = t("position", { index: index + 1, total });
  const id = (key: string) => `${uid}-${key}`;

  /**
   * Content <-> figures. With full motion the view on screen leaves first (the text slides 24 px left and fades in
   * 180 ms; the figures roll back up to the right edge in 240 ms), then the other view enters with its CSS motion.
   */
  function switchView(toFigures: boolean) {
    for (const a of exiting.current) a.cancel();
    exiting.current = [];
    if (toFigures === inFigures) return;
    const apply = () => {
      setView(toFigures ? { figures: true, index: 0 } : TEXT);
      setEntered(true);
    };
    const region = viewRef.current;
    if (
      document.documentElement.dataset.motion !== "full" ||
      !region ||
      typeof region.animate !== "function"
    ) {
      apply();
      return;
    }
    const easing = "cubic-bezier(0.2, 0.7, 0.2, 1)";
    const anims = inFigures
      ? [
          region.animate(
            [{ clipPath: "inset(0)" }, { clipPath: "inset(0 0 0 100%)" }],
            { duration: 240, easing, fill: "forwards" },
          ),
        ]
      : Array.from(region.children, (el) =>
          el.animate(
            [
              { opacity: 1, transform: "translateX(0)" },
              { opacity: 0, transform: "translateX(-24px)" },
            ],
            { duration: 180, easing: "ease-in", fill: "forwards" },
          ),
        );
    exiting.current = anims;
    Promise.all(anims.map((a) => a.finished)).then(
      () => {
        if (exiting.current !== anims) return;
        exiting.current = [];
        apply();
      },
      () => {
        // Cancelled by a newer switch, which owns the view now.
      },
    );
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(null);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content
          data-case-panel=""
          data-context={context}
          className={styles.frame}
          onCloseAutoFocus={(event) => {
            const target = returnFocusRef.current;
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <span aria-hidden="true" className={cn(styles.rod, styles.rodTop)} />
          <span
            aria-hidden="true"
            className={cn(styles.rod, styles.rodBottom)}
          />
          <span aria-hidden="true" className={styles.wash} />
          <span aria-hidden="true" className={styles.grain} />

          <div aria-hidden="true" className={styles.spine}>
            <span lang="ja" className={styles.chapter}>
              {context === "tree" ? t("chapterTree") : t("chapterProjects")}
            </span>
            {inFigures ? (
              <span lang="ja" className={styles.figCount}>
                図 {figureNumeral(figIndex + 1)}／{figureNumeral(figureCount)}
              </span>
            ) : null}
            {total > 0 ? (
              <span className={styles.count}>
                {pad(index + 1)} / {pad(total)}
              </span>
            ) : null}
          </div>

          <div
            ref={setContent}
            data-case-content=""
            data-view={inFigures ? "figures" : "text"}
            className={styles.content}
          >
            <header className={styles.head}>
              <div className="min-w-0">
                <DialogPrimitive.Description className={styles.where}>
                  {[item.where, item.stint].filter(Boolean).join(" · ")}
                </DialogPrimitive.Description>
                {/* data-case-title: the archive's opening View Transition names it (see ProjectArchive). */}
                <DialogPrimitive.Title
                  data-case-title=""
                  className={styles.title}
                >
                  {item.title}
                </DialogPrimitive.Title>
                <dl className={styles.meta}>
                  {meta.map((m) => (
                    <div key={m.label}>
                      <dt>{m.label}</dt>
                      <dd>{m.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className={styles.actions}>
                {figureCount > 0 ? (
                  <div className={styles.seg}>
                    <button
                      type="button"
                      aria-pressed={!inFigures}
                      onClick={() => switchView(false)}
                      className={cn(styles.segBtn, FOCUS)}
                    >
                      <span aria-hidden="true" lang="ja">
                        文
                      </span>
                      {t("content")}
                    </button>
                    <button
                      type="button"
                      aria-pressed={inFigures}
                      onClick={() => switchView(true)}
                      className={cn(styles.segBtn, FOCUS)}
                    >
                      <span aria-hidden="true" lang="ja">
                        図
                      </span>
                      {t("figures")} · {figureCount}
                    </button>
                  </div>
                ) : null}
                {links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      styles.btn,
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    )}
                  >
                    {link.label}
                    <span className="sr-only"> {tp("newTab")}</span>
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => void copyLink(item.id)}
                  className={cn(
                    styles.btn,
                    styles.ghost,
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  )}
                >
                  <CopyIcon aria-hidden="true" className="size-3.5" />
                  {t("copyLink")}
                </button>
                <DialogPrimitive.Close
                  className={cn(
                    styles.close,
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  )}
                >
                  <XIcon aria-hidden="true" className="size-4" />
                  <span className="sr-only">{tc("close")}</span>
                </DialogPrimitive.Close>
              </div>
            </header>

            {inFigures ? (
              <div
                key="figures"
                ref={viewRef}
                data-enter={entered ? "" : undefined}
                className={styles.figView}
              >
                <LazyFigureScroll
                  key={item.id}
                  figures={item.figures}
                  index={figIndex}
                  onIndexChange={(i) => setView({ figures: true, index: i })}
                  title={item.title}
                  theme={theme}
                />
              </div>
            ) : (
              <div
                key="text"
                ref={viewRef}
                data-enter={entered ? "" : undefined}
                className={styles.textView}
              >
                <section
                  aria-labelledby={id("result")}
                  className={styles.result}
                >
                  <span aria-hidden="true" lang="ja" className={styles.seal}>
                    果
                  </span>
                  <div className="relative z-[1] min-w-0">
                    <h3 id={id("result")} className={styles.resultLabel}>
                      {t("result")}
                    </h3>
                    <p className={styles.resultText}>{cs.result}</p>
                  </div>
                </section>

                <div className={styles.panes}>
                  {PANES.map(([key, numeral]) => (
                    <section
                      key={key}
                      aria-labelledby={id(key)}
                      data-pane={key}
                      className={styles.pane}
                    >
                      <div className={styles.paneHead}>
                        <span
                          aria-hidden="true"
                          lang="ja"
                          className={styles.numeral}
                        >
                          {numeral}
                        </span>
                        <h3 id={id(key)} className={styles.paneLabel}>
                          {t(key)}
                        </h3>
                      </div>
                      <p className={styles.paneText}>{cs[key]}</p>
                    </section>
                  ))}
                </div>
              </div>
            )}

            <footer className={styles.foot}>
              <div className={styles.tech}>
                <span id={id("tech")} className={styles.techLabel}>
                  {t("tech")} · {item.tech.length}
                </span>
                <ul aria-labelledby={id("tech")} className={styles.chips}>
                  {item.tech.map((name) => (
                    <li key={name} className={styles.chip}>
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="sr-only" aria-live="polite">
                {item.title}, {position}
              </p>
              {prev && next ? (
                <div className={styles.nav}>
                  <button
                    type="button"
                    aria-label={t("prev", { title: titleOf(prev) })}
                    onClick={() => onOpenChange(prev)}
                    className={cn(
                      styles.navBtn,
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    )}
                  >
                    <span aria-hidden="true">←</span>
                    <kbd aria-hidden="true" className={styles.kbd}>
                      ←
                    </kbd>
                    {titleOf(prev)}
                  </button>
                  <button
                    type="button"
                    aria-label={t("next", { title: titleOf(next) })}
                    onClick={() => onOpenChange(next)}
                    className={cn(
                      styles.navBtn,
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    )}
                  >
                    {titleOf(next)}
                    <kbd aria-hidden="true" className={styles.kbd}>
                      →
                    </kbd>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              ) : null}
            </footer>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
