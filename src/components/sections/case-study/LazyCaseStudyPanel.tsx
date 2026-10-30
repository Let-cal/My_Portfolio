"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentProps } from "react";
import type { CaseStudyPanel } from "./CaseStudyPanel";

const Panel = dynamic(
  () => import("./CaseStudyPanel").then((module) => module.CaseStudyPanel),
  { ssr: false },
);

/**
 * The case study panel, loaded on first use: nothing (no chunk request) until a project is opened, then the lazy
 * panel stays mounted so it can animate its close.
 */
export function LazyCaseStudyPanel(
  props: ComponentProps<typeof CaseStudyPanel>,
) {
  const [used, setUsed] = useState(false);
  if (props.openId !== null && !used) setUsed(true);
  return used ? <Panel {...props} /> : null;
}
