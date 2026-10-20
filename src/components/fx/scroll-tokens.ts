export type ScrollToken = { text: string; unit: number | null };

/** Preserve whitespace and Japanese word boundaries; callable before crossing the client boundary. */
export function tokenizeScrollText(
  text: string,
  locale?: string,
): ScrollToken[] {
  const parts =
    typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter(locale, { granularity: "word" }).segment(text),
          (part) => part.segment,
        )
      : text.split(/(\s+)/).filter(Boolean);
  let unit = 0;
  return parts.map((part) => ({
    text: part,
    unit: /\S/.test(part) ? unit++ : null,
  }));
}
