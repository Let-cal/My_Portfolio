"use client";

import { useLayoutEffect } from "react";
import { restoreSavedTheme } from "./theme";

export function ThemeSync() {
  useLayoutEffect(() => {
    restoreSavedTheme();
  }, []);
  return null;
}
