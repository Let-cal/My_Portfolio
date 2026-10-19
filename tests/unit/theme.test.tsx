import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyTheme,
  restoreSavedTheme,
  useTheme,
} from "@/components/site/theme";
import { THEME_INIT_SCRIPT } from "@/components/site/theme-script";

const html = document.documentElement;

describe("theme", () => {
  beforeEach(() => {
    html.className = "dark";
    localStorage.clear();
  });

  it("applyTheme swaps dark and light and persists the choice", () => {
    applyTheme("light");
    expect(html.classList.contains("light")).toBe(true);
    expect(html.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");

    applyTheme("dark");
    expect(html.classList.contains("dark")).toBe(true);
    expect(html.classList.contains("light")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("useTheme follows the class on <html> and setTheme updates it", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    act(() => result.current.setTheme("light"));
    expect(result.current.theme).toBe("light");
    expect(html.className).toBe("light");
  });

  it("pre-paint script restores a saved light theme and defaults to dark", () => {
    html.className = "dark other";
    localStorage.setItem("theme", "light");
    new Function(THEME_INIT_SCRIPT)();
    expect(html.classList.contains("light")).toBe(true);
    expect(html.classList.contains("dark")).toBe(false);
    expect(html.classList.contains("other")).toBe(true);

    localStorage.clear();
    html.className = "";
    new Function(THEME_INIT_SCRIPT)();
    expect(html.className).toBe("dark");
  });

  it("restoreSavedTheme re-applies the saved theme on a fresh <html class=dark>", () => {
    localStorage.setItem("theme", "light");
    html.className = "dark";
    restoreSavedTheme();
    expect(html.className).toBe("light");
  });
});
