// Bookkeeping for live updates: which changes this tab made itself (no "from elsewhere" toast for
// those), which page must not refresh right now, and the stream of change notes for open forms.

export type ChangeEvent = {
  table: string;
  op: "insert" | "update" | "delete";
  key: string;
};

const OWN_WRITE_WINDOW = 3000;
let lastOwnWrite = -Infinity;
let inFlight = 0;
const held = new Set<string>();
const listeners = new Set<(event: ChangeEvent) => void>();

/** Call around every write this tab makes (runAction does): before sending and after it settles. */
export function markOwnWrite(now = Date.now()) {
  lastOwnWrite = now;
}

/** A write of this tab starts / settles (runAction calls these around every action). */
export function beginOwnWrite() {
  inFlight++;
}
export function endOwnWrite(now = Date.now()) {
  inFlight = Math.max(0, inFlight - 1);
  lastOwnWrite = now;
}

/**
 * True while this tab's own write runs and for a few seconds after it settles: its echo is not
 * news. Counting writes in flight matters for slow (cold) actions whose echo arrives late.
 */
export function isRecentOwnWrite(now = Date.now()) {
  return inFlight > 0 || now - lastOwnWrite < OWN_WRITE_WINDOW;
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
  inFlight = 0;
  held.clear();
}
