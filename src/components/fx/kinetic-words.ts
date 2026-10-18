let segmenter: Intl.Segmenter | undefined;

/** Shared algorithm for server-prepared words and the optional client fallback. */
export function segmentKineticWords(text: string): string[][] {
  return text.split(" ").map((word) => {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return Array.from(segmenter.segment(word), (part) => part.segment);
    }
    return Array.from(word);
  });
}
