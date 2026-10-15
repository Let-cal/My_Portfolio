"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";

type TerminalProps = {
  /** Accessible name of the terminal. */
  label: string;
  /** What `whoami` prints: name and the title of the current role. */
  identity: string;
  /** Group id shown in `skills --group <group>`. */
  group: string;
  /** What that command prints. */
  skills: string[];
};

type Progress = {
  /** Characters of `whoami` typed so far. */
  c1: number;
  /** Whether the `whoami` output has been printed. */
  o1: boolean;
  /** Characters of the `skills` command typed so far. */
  c2: number;
  o2: boolean;
};

const EMPTY: Progress = { c1: 0, o1: false, c2: 0, o2: false };

type Action = { type: "reset" } | { type: "keepFirst" } | { type: "type"; key: "c1" | "c2"; n: number } | { type: "print"; key: "o1" | "o2" };

function reducer(state: Progress, action: Action): Progress {
  switch (action.type) {
    case "reset":
      return EMPTY;
    case "keepFirst":
      return { ...state, c2: 0, o2: false };
    case "type":
      return { ...state, [action.key]: action.n };
    case "print":
      return { ...state, [action.key]: true };
  }
}

/** Keystroke delay in ms: steady with a small deterministic wobble so it reads as typing, not a metronome. */
const keyDelay = (i: number) => 38 + ((i * 17) % 29);

/**
 * Mini terminal (S4). Types `whoami` and prints the visitor-facing identity (name and title of the current role), then
 * types `skills --group <group>` and prints that group's skills. Typing starts when the terminal scrolls into view and
 * restarts from the second command when only the group changes (from the start when the identity changes). Reduced
 * motion shows the final text at once. The animated screen is hidden from assistive tech; one polite live region
 * holds the final result, so a screen reader hears it once and not per keystroke.
 */
export function SkillTerminal({ label, identity, group, skills }: TerminalProps) {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  // Without IntersectionObserver (old browsers, tests) there is nothing to wait for.
  const [started, setStarted] = useState(() => typeof IntersectionObserver === "undefined");
  const [progress, dispatch] = useReducer(reducer, EMPTY);
  /** Identity the first command was last typed for, and whether its output has been printed. */
  const typedFor = useRef<{ identity: string | null; printed: boolean }>({ identity: null, printed: false });

  const cmd1 = "whoami";
  const cmd2 = `skills --group ${group}`;
  const listKey = skills.join("\n");

  useEffect(() => {
    const root = rootRef.current;
    if (started || !root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setStarted(true);
      },
      { threshold: 0.4 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || reduced) return;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    function typeText(key: "c1" | "c2", text: string, done: () => void) {
      let i = 0;
      const tick = () => {
        i += 1;
        dispatch({ type: "type", key, n: i });
        if (i < text.length) later(tick, keyDelay(i));
        else later(done, 240);
      };
      later(tick, keyDelay(0));
    }
    const second = () => typeText("c2", cmd2, () => dispatch({ type: "print", key: "o2" }));

    const memo = typedFor.current;
    if (memo.identity === identity && memo.printed) {
      // Only the group changed: keep `whoami` on screen and retype the second command.
      later(() => dispatch({ type: "keepFirst" }), 0);
      later(second, 120);
    } else {
      memo.identity = identity;
      memo.printed = false;
      later(() => dispatch({ type: "reset" }), 0);
      later(
        () =>
          typeText("c1", cmd1, () => {
            dispatch({ type: "print", key: "o1" });
            memo.printed = true;
            later(second, 380);
          }),
        220,
      );
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [started, reduced, identity, cmd2, listKey]);

  // Reduced motion: the final text, no state involved. Before the terminal starts: just the prompt.
  const p = reduced ? { c1: Infinity, o1: true, c2: Infinity, o2: true } : progress;
  const caret = <span className="skill-caret" />;

  return (
    <div
      ref={rootRef}
      data-skill-terminal=""
      role="group"
      aria-label={label}
      className="skill-terminal flex h-[17.9rem] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0f16] font-mono text-[12.5px] leading-relaxed text-slate-300 shadow-[0_20px_60px_-30px_var(--role-accent)]"
    >
      <div aria-hidden="true" className="flex h-9 shrink-0 items-center gap-1.5 border-b border-white/10 bg-white/[0.03] px-3">
        <span className="size-2.5 rounded-full bg-[#ff5f57]/80" />
        <span className="size-2.5 rounded-full bg-[#febc2e]/80" />
        <span className="size-2.5 rounded-full bg-[#28c840]/80" />
        <span className="ml-2 truncate text-[11px] text-slate-400">letcal ~ skills</span>
      </div>

      <div data-terminal-screen="" aria-hidden="true" className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <p>
          <span className="text-(--role-accent)">$</span> {cmd1.slice(0, p.c1)}
          {p.o1 ? null : caret}
        </p>
        {p.o1 ? <p className="mb-2 text-slate-100">{identity}</p> : null}
        {p.c2 > 0 ? (
          <p>
            <span className="text-(--role-accent)">$</span> {cmd2.slice(0, p.c2)}
            {p.o2 ? null : caret}
          </p>
        ) : null}
        {p.o2 ? (
          <>
            <ul className="mt-1 mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-sky-200/90">
              {skills.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p>
              <span className="text-(--role-accent)">$</span> {caret}
            </p>
          </>
        ) : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {`${cmd2}: ${skills.join(", ")}`}
      </p>
    </div>
  );
}
