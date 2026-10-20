// Bookkeeping for live updates: which changes this tab made itself (no "from elsewhere" toast for
// those), which page must not refresh right now, and the stream of change notes for open forms.

export type ChangeEvent = {
  table: string;
  op: "insert" | "update" | "delete";
  key: string;
};

const OWN_WRITE_WINDOW = 3000;
let lastOwnWrite = -Infinity;
const held = new Set<string>();
const listeners = new Set<(event: ChangeEvent) => void>();

/** Call around every write this tab makes (runAction does): before sending and after it settles. */
export function markOwnWrite(now = Date.now()) {
  lastOwnWrite = now;
}

/** True within a few seconds of this tab's own write: its echo is not news. */
export function isRecentOwnWrite(now = Date.now()) {
  return now - lastOwnWrite < OWN_WRITE_WINDOW;
}

/** A page whose item vanished under unsaved edits holds refreshes, which would replace it with a 404. */
export function holdRefresh(path: string, on: boolean) {
  if (on) held.add(path);
  else held.delete(path);
}

export const isRefreshHeld = (path: string) => held.has(path);

export function publishChange(event: ChangeEvent) {
  for (const listener of listeners) listener(event);
}

export function onChange(listener: (event: ChangeEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For tests. */
export function resetOwnWrites() {
  lastOwnWrite = -Infinity;
  held.clear();
}
