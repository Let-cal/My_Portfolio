/**
 * Arrow keys, Home and End for a radiogroup or tablist whose options are its direct children:
 * selects the next option and moves focus to it (one tab stop for the whole group).
 */
export function rovingKey<T>(
  e: React.KeyboardEvent<HTMLElement>,
  values: readonly T[],
  current: T,
  select: (value: T) => void,
) {
  const i = values.indexOf(current);
  const target: Record<string, number> = {
    ArrowRight: i + 1,
    ArrowDown: i + 1,
    ArrowLeft: i - 1,
    ArrowUp: i - 1,
    Home: 0,
    End: values.length - 1,
  };
  if (!(e.key in target)) return;
  e.preventDefault();
  const j = (target[e.key] + values.length) % values.length;
  select(values[j]);
  e.currentTarget.parentElement
    ?.querySelectorAll<HTMLElement>(":scope > [role]")
    [j]?.focus();
}
