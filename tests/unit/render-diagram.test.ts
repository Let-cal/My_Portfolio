// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  bytesToBase64,
  DIAGRAM_FONT_URL,
  embedFont,
  loadMermaid,
  MERMAID_LOAD_TIMEOUT_MS,
  MERMAID_SCRIPT_URL,
  MERMAID_VERSION,
  readViewBox,
  setIntrinsicSize,
} from "@/lib/admin/render-diagram";
import { isSafeSvg } from "@/lib/figures/svg-safety";

// What Mermaid returns: responsive width, a max-width style, a viewBox.
const MERMAID_LIKE =
  `<svg id="figure-diagram-dark" width="100%" xmlns="http://www.w3.org/2000/svg" ` +
  `class="flowchart" style="max-width: 412.5px; background-color: transparent;" ` +
  `viewBox="0 0 412.5 87.2" role="graphics-document document">` +
  `<style>#figure-diagram-dark{font-family:"Space Grotesk",sans-serif}</style>` +
  `<g><rect stroke-width="1.5" width="40" height="20"/><text>API</text></g></svg>`;

describe("render-diagram helpers", () => {
  it("reads the viewBox size, rounding up", () => {
    expect(readViewBox(MERMAID_LIKE)).toEqual({ width: 413, height: 88 });
  });

  it("throws on a missing or empty viewBox", () => {
    expect(() => readViewBox(`<svg xmlns="x"></svg>`)).toThrow(/viewBox/);
    expect(() => readViewBox(`<svg viewBox="0 0 0 0"></svg>`)).toThrow(
      /viewBox/,
    );
  });

  it("gives the root an intrinsic size and drops the responsive style", () => {
    const out = setIntrinsicSize(MERMAID_LIKE);
    expect(out.width).toBe(413);
    expect(out.height).toBe(88);
    const open = /<svg\b[^>]*>/.exec(out.svg)![0];
    expect(open).toContain('width="413"');
    expect(open).toContain('height="88"');
    expect(open).not.toContain("100%");
    expect(open).not.toContain("max-width");
    expect(open).toContain('viewBox="0 0 412.5 87.2"');
    expect(open).toContain('xmlns="http://www.w3.org/2000/svg"');
    // Attributes on inner elements are untouched.
    expect(out.svg).toContain('stroke-width="1.5"');
    expect(out.svg).toContain('<rect stroke-width="1.5" width="40"');
  });

  it("embeds the font as a data:font/woff2 face that isSafeSvg accepts", () => {
    const font = readFileSync(
      join(process.cwd(), "public", DIAGRAM_FONT_URL.replace(/^\//, "")),
    );
    const base64 = bytesToBase64(new Uint8Array(font));
    expect(base64).toBe(font.toString("base64"));
    const out = embedFont(setIntrinsicSize(MERMAID_LIKE).svg, base64);
    expect(out).toContain("@font-face");
    expect(out).toContain(`url(data:font/woff2;base64,${base64.slice(0, 20)}`);
    // The face sits straight after the root tag, before Mermaid's own style.
    expect(out.indexOf("@font-face")).toBeLessThan(out.indexOf("<g>"));
    expect(isSafeSvg(out)).toEqual({ ok: true });
  });

  it("refuses input without a root element", () => {
    expect(() => embedFont("<g/>", "AAAA")).toThrow(/svg/);
    expect(() => setIntrinsicSize("<g/>")).toThrow();
  });
});

describe("vendored Mermaid", () => {
  it("names the installed Mermaid version, so a package upgrade busts the cached copy", () => {
    const pkg = JSON.parse(
      readFileSync(
        join(process.cwd(), "node_modules/mermaid/package.json"),
        "utf8",
      ),
    ) as { version: string };
    expect(MERMAID_VERSION).toBe(pkg.version);
    expect(MERMAID_SCRIPT_URL).toBe(`/vendor/mermaid.min.js?v=${pkg.version}`);
  });

  it("is copied before every build and dev server", () => {
    const scripts = (
      JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    expect(scripts.prebuild).toContain("node scripts/copy-mermaid.mjs");
    expect(scripts.predev).toContain("node scripts/copy-mermaid.mjs");
  });
});

describe("loading Mermaid", () => {
  it("gives up after the load timeout, removes the script and lets the next render retry", async () => {
    vi.useFakeTimers();
    try {
      // jsdom never runs the script, so it neither loads nor errors: the timeout is the only way out.
      const first = loadMermaid();
      const settled = expect(first).rejects.toThrow(/Mermaid tải quá lâu/);
      await vi.advanceTimersByTimeAsync(MERMAID_LOAD_TIMEOUT_MS);
      await settled;
      expect(
        document.querySelectorAll(`script[src="${MERMAID_SCRIPT_URL}"]`),
      ).toHaveLength(0);
      const second = loadMermaid();
      expect(
        document.querySelectorAll(`script[src="${MERMAID_SCRIPT_URL}"]`),
      ).toHaveLength(1);
      second.catch(() => {});
      await vi.advanceTimersByTimeAsync(MERMAID_LOAD_TIMEOUT_MS);
    } finally {
      vi.useRealTimers();
    }
  });
});
