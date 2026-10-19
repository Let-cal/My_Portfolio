"use client";

import { useEffect, useState } from "react";

/** Keep only the outgoing text nodes, until their existing CSS exit animation finishes. */
export function useExitingValue<T extends string | number>(
  value: T,
  reduced: boolean,
  duration = 350,
) {
  const [frames, setFrames] = useState({
    current: { value, key: 0 },
    leaving: [] as { value: T; key: number }[],
  });
  if (frames.current.value !== value) {
    setFrames({
      current: { value, key: frames.current.key + 1 },
      leaving: reduced ? [] : [...frames.leaving, frames.current],
    });
  } else if (reduced && frames.leaving.length) {
    setFrames({ current: frames.current, leaving: [] });
  }
  useEffect(() => {
    if (!frames.leaving.length) return;
    const keys = new Set(frames.leaving.map((frame) => frame.key));
    const timer = setTimeout(
      () =>
        setFrames((previous) => ({
          ...previous,
          leaving: previous.leaving.filter((frame) => !keys.has(frame.key)),
        })),
      duration + 50,
    );
    return () => clearTimeout(timer);
  }, [frames.leaving, duration]);
  return {
    ...frames,
    finish: (key: number) =>
      setFrames((previous) => ({
        ...previous,
        leaving: previous.leaving.filter((frame) => frame.key !== key),
      })),
  };
}
