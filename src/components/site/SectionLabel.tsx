/**
 * Numbered section heading line ("01 — Experience") plus a vertical Japanese chapter label in the left
 * margin of the section. Place it as the first child of a `relative` section wrapper; the vertical label is
 * decorative (aria-hidden) and only shown where the margin is wide enough (md and up).
 */
export function SectionLabel({ index, title, kanji }: { index: string; title: string; kanji: string }) {
  return (
    <>
      {/* Chapter "00" (the hero) has no numbered line, only the vertical kanji. */}
      {index !== "00" && (
        <p
          aria-hidden="true"
          data-scene-avoid=""
          className="pointer-events-none absolute inset-x-0 top-14 mx-auto max-w-6xl px-4 text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase sm:px-6"
        >
          {`${index} — ${title}`}
        </p>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-24 left-1 hidden font-[family-name:var(--font-mincho)] text-xs tracking-[0.25em] whitespace-nowrap select-none md:block"
        style={{ writingMode: "vertical-rl", opacity: 0.35 }}
      >
        {kanji}
      </span>
    </>
  );
}
