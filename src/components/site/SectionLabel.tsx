/**
 * Numbered section heading line ("01 — Experience") plus a vertical Japanese chapter label in the left
 * upper-right chapter seal. Place it as the first child of a `relative` section wrapper; the vertical label is
 * decorative (aria-hidden) and only shown where the margin is wide enough (md and up).
 */
export function SectionLabel({
  index,
  title,
  kanji,
}: {
  index: string;
  title: string;
  kanji: string;
}) {
  return (
    <>
      {/* Chapter "00" (the hero) has no numbered line, only the vertical kanji. */}
      {index !== "00" && (
        <p
          aria-hidden="true"
          data-scene-avoid=""
          className="pointer-events-none absolute inset-x-0 top-14 mx-auto max-w-6xl px-4 pr-20 text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase sm:px-6 sm:pr-20"
        >
          {`${index} — ${title}`}
        </p>
      )}
      <span
        aria-hidden="true"
        data-chapter-seal=""
        className="pointer-events-none absolute top-5 right-6 hidden h-12 font-[family-name:var(--font-mincho)] text-xs leading-4 tracking-[0.2em] whitespace-normal select-none md:block"
        style={{ writingMode: "vertical-rl", opacity: 0.35 }}
      >
        {kanji}
      </span>
    </>
  );
}
