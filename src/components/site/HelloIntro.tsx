"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { HELLO_STORAGE_KEY } from "./hello-script";
import { getMotionReduced } from "./motion-preference";

const GREETINGS = [
  { text: "Hello", lang: "en" },
  { text: "こんにちは", lang: "ja" },
  { text: "Xin chào", lang: "vi" },
] as const;

/** 3 x 350 + 300 = 1.35s, inside the 1.4s budget of spec 13.1 G3. */
const WORD_MS = 350;
const SLIDE_MS = 300;

function readSeen(): boolean {
  try {
    return window.sessionStorage.getItem(HELLO_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

/**
 * Greeting shown once per browser session: a compact pill on phones, a curtain on larger screens.
 * Hello, こんにちは, Xin chào (350ms each), then the
 * curtain slides up (300ms). A click or any key skips it. It is aria-hidden and the page is already rendered
 * underneath. Not shown when motion is off (the Motion toggle, else the OS setting) or when `sessionStorage.hello` is "1".
 *
 * The overlay is part of the server HTML so there is no flash of content. A tiny head script marks
 * returning visitors (see hello-script.ts) and CSS hides the overlay for them and for reduced motion
 * (`<html data-motion="reduced">`) before hydration; a CSS animation also hides it after 2.5s if scripts never run.
 */
export function HelloIntro() {
  const reduced = usePrefersReducedMotion();
  const seen = useSyncExternalStore(noopSubscribe, readSeen, () => false);
  // 0..2 = greeting shown, 3 = curtain sliding up, 4 = finished.
  const [step, setStep] = useState(0);
  const running = !seen && !reduced && step < 4;

  const finish = useCallback(() => {
    try {
      window.sessionStorage.setItem(HELLO_STORAGE_KEY, "1");
    } catch {
      // Storage blocked: the greeting may play again on the next page load.
    }
    setStep(4);
  }, []);

  // A visitor who arrives with motion off (or an OS that asks for reduced motion) never gets the greeting, even
  // if they switch motion on later in the same visit; the greeting is for the first paint only.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (getMotionReduced()) setStep(4);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => (step >= 3 ? finish() : setStep(step + 1)), step === 3 ? SLIDE_MS : WORD_MS);
    return () => clearTimeout(timer);
  }, [running, step, finish]);

  useEffect(() => {
    if (!running) return;
    window.addEventListener("keydown", finish);
    return () => window.removeEventListener("keydown", finish);
  }, [running, finish]);

  if (!running) return null;
  const greeting = GREETINGS[Math.min(step, GREETINGS.length - 1)];
  return (
    <div
      data-hello
      aria-hidden="true"
      onClick={finish}
      className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-[#0a0a0b] text-[#f4f4f5] max-md:inset-auto max-md:right-4 max-md:bottom-24 max-md:rounded-full max-md:border max-md:border-white/15 max-md:px-4 max-md:py-3"
      style={{
        transform: step === 3 ? "translateY(-100%)" : "translateY(0)",
        transition: `transform ${SLIDE_MS}ms cubic-bezier(0.76, 0, 0.24, 1)`,
      }}
    >
      <p
        key={greeting.text}
        lang={greeting.lang}
        className="hello-word flex items-center gap-4 font-heading text-base font-medium tracking-tight md:text-5xl lg:text-7xl"
      >
        <span aria-hidden="true" className="size-2.5 rounded-full sm:size-3.5" style={{ backgroundColor: "var(--role-accent, #f97316)" }} />
        {greeting.text}
      </p>
    </div>
  );
}
