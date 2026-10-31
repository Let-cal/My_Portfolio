"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { TextScramble } from "@/components/fx/TextScramble";
import type { RoleKey } from "@/content/schema";
import { useRole } from "./RoleProvider";
import type { SectionId } from "./sections";
import { useActiveSection } from "./use-active-section";

/*
 * The client islands of the server-rendered side rail. Everything else (numerals, labels, hairlines, the thread's
 * SVG, the spur, the peek cards) is static markup, and the thread engine is a separate chunk loaded when idle.
 */

const Active = createContext<SectionId | null>(null);

type Engine = { update(): void; stop(): void };
type Box = { className?: string; children: ReactNode };

/**
 * Wraps the ink thread. `useActiveSection` is its only React state; the engine (`./ink-thread`) is imported when the
 * browser is idle and then writes the fill, the drop and the hairlines straight to the DOM.
 */
export function InkThread({ className, children }: Box) {
  const active = useActiveSection();
  const ref = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine>(null);

  useEffect(() => {
    let cancelled = false;
    const start = () =>
      import("./ink-thread").then(
        (m) => {
          if (!cancelled && ref.current)
            engine.current = m.attachInkThread(ref.current);
        },
        // A failed decorative chunk leaves the static rail, which still links and marks the current chapter.
        () => {},
      );
    (window.requestIdleCallback ?? setTimeout)(start);
    return () => {
      cancelled = true;
      engine.current?.stop();
      engine.current = null;
    };
  }, []);

  // React marked the new chapter with aria-current; the engine reads it on its next frame.
  useEffect(() => engine.current?.update(), [active]);

  return (
    <div ref={ref} data-ink-root="" className={className}>
      <Active value={active}>{children}</Active>
    </div>
  );
}

/** An in-page chapter link, `aria-current` while its section crosses the reading line. */
export function ChapterLink({
  id,
  className,
  children,
}: Box & { id: SectionId }) {
  const current = useContext(Active) === id;
  return (
    <a
      href={`#${id}`}
      data-chapter={id}
      aria-current={current ? "true" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}

/** The all-projects page link (the thread's spur), `aria-current="page"` on that page. */
export function ArchiveLink({
  href,
  className,
  children,
}: Box & { href: string }) {
  const here = /\/projects\/?$/.test(usePathname() ?? "");
  return (
    <a
      href={href}
      aria-current={here ? "page" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}

/** The job title of the chosen role, scrambling to the new one when the role changes. */
export function RoleTitle({ titles }: { titles: Record<RoleKey, string> }) {
  return <TextScramble text={titles[useRole().role]} />;
}
