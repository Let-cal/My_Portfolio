"use client";

import { Noto_Sans_JP } from "next/font/google";

const japaneseBodyFont = Noto_Sans_JP({
  subsets: ["latin"],
  display: "optional",
  preload: false,
});

export default function JapaneseFontFace() {
  return (
    <style>{`body:lang(ja){--font-noto-sans-jp:${japaneseBodyFont.style.fontFamily}}`}</style>
  );
}
