// Keeping client screens in step with server data while optimistic changes are pending.

/** Stable JSON (sorted keys), to tell whether server data really changed between renders. */
export function signature(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

/** Server rows with the changes this tab is still saving laid over them. */
export function mergeRows<T extends { id: string }>(
  server: T[],
  pending: Map<string, Partial<T> | "deleted">,
): T[] {
  return server.flatMap((row) => {
    const change = pending.get(row.id);
    if (change === "deleted") return [];
    return [change ? { ...row, ...change } : row];
  });
}

/** Window event: drop unsaved edits in open forms without asking (e.g. right before a restore). */
export const ADMIN_DISCARD_EVENT = "admin:discard-edits";
