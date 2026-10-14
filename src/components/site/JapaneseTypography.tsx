"use client";

import dynamic from "next/dynamic";

const JapaneseFontFace = dynamic(() => import("./JapaneseFontFace"), { ssr: false });

/** Only mounted on /ja; keep the unicode-range stylesheet out of other locales and the first paint. */
export function JapaneseTypography() {
  return <JapaneseFontFace />;
}
