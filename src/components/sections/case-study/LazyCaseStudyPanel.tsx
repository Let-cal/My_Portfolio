"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentProps } from "react";
import { CASE_PARAM } from "@/lib/case-list";
import type { CaseStudyPanel } from "./CaseStudyPanel";

type Props = ComponentProps<typeof CaseStudyPanel>;

/**
 * Stands in for a panel whose chunk failed to load (a stale deploy, a dropped connection): a fresh page load of
 * the same URL with `?case=<id>` opens the panel through its deep link. Once per project per tab, so a chunk that
 * stays broken shows nothing instead of reloading forever.
 */
function ReloadOnDeepLink({ openId }: Props) {
  useEffect(() => {
    if (openId === null) return;
    const key = `case-reload:${openId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      return; // No storage to guard a reload with.
    }
    const url = new URL(window.location.href);
    url.searchParams.set(CASE_PARAM, openId);
    window.location.assign(url.href);
  }, [openId]);
  return null;
}

const Panel = dynamic(
  () =>
    import("./CaseStudyPanel").then(
      (module) => module.CaseStudyPanel,
      () => ReloadOnDeepLink,
    ),
  { ssr: false },
);

/**
 * The case study panel, loaded on first use: nothing (no chunk request) until a project is opened, then the lazy
 * panel stays mounted so it can animate its close.
 */
export function LazyCaseStudyPanel(props: Props) {
  const [used, setUsed] = useState(false);
  if (props.openId !== null && !used) setUsed(true);
  return used ? <Panel {...props} /> : null;
}
