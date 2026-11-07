import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  diagramPath,
  MERMAID_THEME_VERSION,
  mermaidConfig,
} from "@/lib/figures/mermaid-theme";

const sha8 = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex").slice(0, 8);

describe("mermaidConfig", () => {
  const light = mermaidConfig("light");
  const dark = mermaidConfig("dark");

  it("has a theme version", () => {
    expect(MERMAID_THEME_VERSION).toBe(1);
  });

  it("uses SVG text labels, a strict security level and no auto start", () => {
    for (const cfg of [light, dark]) {
      expect(cfg.htmlLabels).toBe(false);
      expect(cfg.securityLevel).toBe("strict");
      expect(cfg.startOnLoad).toBe(false);
      expect(cfg.theme).toBe("base");
    }
  });

  it("uses Space Grotesk in both themes", () => {
    expect(light.fontFamily).toBe("Space Grotesk");
    expect(dark.fontFamily).toBe("Space Grotesk");
    expect(light.themeVariables?.fontFamily).toBe(
      dark.themeVariables?.fontFamily,
    );
    expect(light.themeVariables?.fontFamily).toContain("Space Grotesk");
  });

  it("is transparent and differs where the themes differ", () => {
    expect(light.themeVariables?.background).toBe("transparent");
    expect(dark.themeVariables?.background).toBe("transparent");
    expect(light.themeVariables?.textColor).not.toBe(
      dark.themeVariables?.textColor,
    );
    expect(light.themeVariables?.primaryColor).not.toBe(
      dark.themeVariables?.primaryColor,
    );
    expect(light.themeVariables?.darkMode).toBe(false);
    expect(dark.themeVariables?.darkMode).toBe(true);
  });

  it("takes the site tokens (card fill, foreground text, koi orange lines)", () => {
    expect(dark.themeVariables?.primaryColor).toBe("#141416");
    expect(dark.themeVariables?.textColor).toBe("#f4f4f5");
    expect(light.themeVariables?.primaryColor).toBe("#ffffff");
    expect(light.themeVariables?.textColor).toBe("#18181b");
    for (const cfg of [light, dark]) {
      expect(cfg.themeVariables?.lineColor).toBe("rgba(249, 115, 22, 0.7)");
    }
  });

  it("alternates ER attribute rows between card and muted surface", () => {
    for (const cfg of [light, dark]) {
      const v = cfg.themeVariables;
      expect(v?.attributeBackgroundColorOdd).toBe(v?.primaryColor);
      expect(v?.attributeBackgroundColorEven).toBe(v?.secondaryColor);
      expect(v?.attributeBackgroundColorOdd).not.toBe(
        v?.attributeBackgroundColorEven,
      );
      expect(v?.rowOdd).toBe(v?.primaryColor);
      expect(v?.rowEven).toBe(v?.secondaryColor);
    }
  });

  it("holds only literal colours, never CSS variables", () => {
    expect(JSON.stringify([light, dark])).not.toContain("var(");
  });

  it("returns a fresh object each call", () => {
    expect(mermaidConfig("dark")).not.toBe(mermaidConfig("dark"));
    expect(mermaidConfig("dark")).toEqual(mermaidConfig("dark"));
  });
});

describe("diagramPath", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text>A</text></svg>`;

  it("builds the storage path below media/", () => {
    expect(diagramPath("siteplus", "arch", "dark", svg)).toMatch(
      /^diagram\/siteplus-arch-dark-[0-9a-f]{8}\.svg$/,
    );
  });

  it("changes with the SVG and the theme, and is stable otherwise", () => {
    const a = diagramPath("siteplus", "arch", "dark", svg);
    expect(diagramPath("siteplus", "arch", "dark", svg)).toBe(a);
    expect(diagramPath("siteplus", "arch", "dark", svg + " ")).not.toBe(a);
    expect(diagramPath("siteplus", "arch", "light", svg)).not.toBe(a);
  });

  it("hashes with SHA-256 over the UTF-8 bytes", () => {
    expect(diagramPath("p", "f", "light", "abc")).toBe(
      "diagram/p-f-light-ba7816bf.svg",
    );
    expect(diagramPath("p", "f", "light", "")).toBe(
      "diagram/p-f-light-e3b0c442.svg",
    );
    for (const text of [
      "héllo",
      "日本語 😀",
      "x".repeat(55),
      "x".repeat(56),
      "x".repeat(64),
      "x".repeat(1000),
    ]) {
      expect(diagramPath("p", "f", "dark", text)).toBe(
        `diagram/p-f-dark-${sha8(text)}.svg`,
      );
    }
  });
});
