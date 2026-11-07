import type { Figure, FigureCategory, Locale } from "@/content/schema";
import { pickLocale } from "@/lib/i18n-text";
import { FIGURE_KANJI } from "./categories";

/**
 * A figure as visitors get it, every text already picked for the locale. This is the only place a stored figure
 * becomes public: the Mermaid source, `renderedAt` and `themeVersion` are admin-only and never copied here.
 */
export type FigureView = {
  id: string;
  kind: "image" | "diagram";
  category: FigureCategory;
  kanji: string;
  caption: string;
  /** Second line under the caption; null when the note is empty. */
  note: string | null;
  alt: string;
  width: number;
  height: number;
  /** Image url, or the light SVG of a diagram. */
  src: string;
  /** The dark SVG of a diagram; null for an image. */
  srcDark: string | null;
};

/** Public views of a project's figures in their stored order; JA/VI fall back to EN through `pickLocale`. */
export function figureViews(media: Figure[], locale: Locale): FigureView[] {
  return media.map((f): FigureView => {
    const common = {
      id: f.id,
      kind: f.kind,
      category: f.category,
      kanji: FIGURE_KANJI[f.category],
      caption: pickLocale(f.caption, locale),
      note: pickLocale(f.note, locale) || null,
      alt: pickLocale(f.alt, locale),
      width: f.width,
      height: f.height,
    };
    return f.kind === "image"
      ? { ...common, src: f.url, srcDark: null }
      : { ...common, src: f.svgLight, srcDark: f.svgDark };
  });
}
