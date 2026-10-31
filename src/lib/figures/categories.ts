import type { FigureCategory } from "@/content/schema";

/** One kanji per figure category, shown on the gallery filter chips and figure labels. */
export const FIGURE_KANJI: Record<FigureCategory, string> = {
  screen: "画",
  architecture: "構",
  erd: "表",
  flow: "流",
  other: "他",
};
