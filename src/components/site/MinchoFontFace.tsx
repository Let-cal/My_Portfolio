"use client";

import { Shippori_Mincho } from "next/font/google";

const mincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: "500",
  display: "optional",
  preload: false,
});

export default function MinchoFontFace() {
  return <style>{`body{--font-mincho:${mincho.style.fontFamily}}`}</style>;
}
