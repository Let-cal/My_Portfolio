"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-media-query";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&";
const TICK_MS = 40;

type TextScrambleProps = {
  text: string;
  durationMs?: number;
  className?: string;
};

function scrambleFrame(target: string, progress: number) {
  const chars = Array.from(target);
  const settled = Math.floor(progress * chars.length);
  return chars
    .map((ch, i) => (i < settled || ch === " " ? ch : CHARSET[Math.floor(Math.random() * CHARSET.length)]))
    .join("");
}

/**
 * When `text` changes the characters shuffle and lock onto the new string from left to right.
 * The accessible name is always the final text (sr-only); the shuffling copy is aria-hidden.
 */
export function TextScramble({ text, durationMs = 500, className }: TextScrambleProps) {
  const reduced = usePrefersReducedMotion();
  // A frame is tagged with the text it belongs to, so a stale frame from a previous target is never shown.
  const [frame, setFrame] = useState<{ target: string; value: string } | null>(null);
  const previous = useRef(text);

  useEffect(() => {
    if (previous.current === text) return;
    previous.current = text;
    if (reduced) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      if (progress >= 1) {
        clearInterval(timer);
        setFrame({ target: text, value: text });
      } else {
        setFrame({ target: text, value: scrambleFrame(text, progress) });
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [text, durationMs, reduced]);

  const visible = frame && frame.target === text ? frame.value : text;
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{visible}</span>
    </span>
  );
}
