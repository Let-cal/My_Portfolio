"use client";

import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import { ensureToaster } from "@/components/site/toast-readiness";
import { CopyIcon, XIcon } from "@/components/site/icons";
import { CASE_PARAM, neighbours, type CaseContext } from "@/lib/case-list";
import { repoLinks } from "@/lib/repo-links";
import { cn } from "@/lib/utils";
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

/**
 * Wide when the whole case study fits the panel, otherwise (or on a small viewport) the scrolling one-column
 * layout. Written straight to `data-mode` (never rendered by React): reset to wide, read the overflow, set the
 * result, all before paint. Measured on open, on every project change, when the panel's box resizes and when
 * web fonts finish loading.
 */
function useFitMode(content: HTMLElement | null, itemId: string | null) {
  useLayoutEffect(() => {
    const frame = content?.parentElement;
    if (!content || !frame) return;
    const small =
      typeof window.matchMedia === "function" ? window.matchMedia(SMALL) : null;
    const measure = () => {
      content.setAttribute("data-mode", "wide");
      if (small?.matches || content.scrollHeight > content.clientHeight + 1)
        content.setAttribute("data-mode", "scroll");
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
    void document.fonts?.ready.then(() => {
      if (alive) measure();
    });
    return () => {
      alive = false;
      observer?.disconnect();
      small?.removeEventListener?.("change", measure);
    };
  }, [content, itemId]);
}

/**
 * The 掛軸 Kakejiku case study panel (spec 5.4): a centred Radix Dialog (focus trap, Esc, focus back to the
 * opener) mounted like a hanging scroll. Spine with the chapter and position, header with the meta row and the
 * actions, the result banner with its 果 seal, the Problem / Role / Decisions panes, and a footer with every tech
 * chip and the previous / next projects of the list it was opened from (also ←/→ outside text fields).
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

  useFitMode(open ? content : null, shownId);

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
  }, [open, prev, next, onOpenChange]);

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
    // Without a clipboard the toast carries the URL itself, so it can still be copied by hand.
    void Promise.all([ensureToaster(), import("sonner")])
      .then(([, { toast }]) =>
        toast(copied ? t("copied") : t("copyLink"), { description: href }),
      )
      .catch(() => {});
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
            {total > 0 ? (
              <span className={styles.count}>
                {pad(index + 1)} / {pad(total)}
              </span>
            ) : null}
          </div>

          <div ref={setContent} data-case-content="" className={styles.content}>
            <header className={styles.head}>
              <div className="min-w-0">
                <DialogPrimitive.Description className={styles.where}>
                  {[item.where, item.stint].filter(Boolean).join(" · ")}
                </DialogPrimitive.Description>
                <DialogPrimitive.Title className={styles.title}>
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

            <section aria-labelledby={id("result")} className={styles.result}>
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
              {prev && next ? (
                <div className={styles.nav}>
                  <p className="sr-only">{position}</p>
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
              ) : (
                <p className="sr-only">{position}</p>
              )}
            </footer>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
