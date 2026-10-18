"use client";

import dynamic from "next/dynamic";
import { useMediaQuery } from "@/components/fx/use-media-query";

const MinchoFontFace = dynamic(() => import("./MinchoFontFace"), { ssr: false });

/** Chapter labels are hidden below md; don't fetch their large font stylesheet on phones. */
export function AccentTypography() {
  const labelsVisible = useMediaQuery("(min-width: 768px)");
  return labelsVisible ? <MinchoFontFace /> : null;
}
