/** ⌘K on Apple devices, Ctrl+K elsewhere (accepting either is harmless). */
export function isPaletteShortcut(event: KeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    event.key.toLowerCase() === "k"
  );
}
