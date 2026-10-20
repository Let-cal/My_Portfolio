// Unsaved form drafts kept in the browser, so a closed tab or an expired session loses nothing.
// Storage is passed in (localStorage in the app) and every access tolerates a broken or full store.

export type Draft = {
  values: Record<string, unknown>;
  savedAt: string;
  /** Signature of the server data the draft started from, to tell when that data has moved on. */
  baseSignature: string;
};

type Store = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

const PREFIX = "admin.draft.";
const DAY = 24 * 60 * 60 * 1000;

export const draftKey = (table: string, id: string) =>
  `${PREFIX}${table}.${id}`;

export function saveDraft(store: Store, key: string, draft: Draft) {
  try {
    store.setItem(key, JSON.stringify(draft));
  } catch {
    // Full or blocked storage: drafts are a convenience, saving still works.
  }
}

export function clearDraft(store: Store, key: string) {
  try {
    store.removeItem(key);
  } catch {
    // ignore
  }
}

function parse(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Draft;
    return draft && typeof draft === "object" && draft.values && draft.savedAt
      ? draft
      : null;
  } catch {
    return null;
  }
}

/** The draft under `key`, or null. Drafts older than `maxAgeDays` are removed. */
export function readDraft(
  store: Store,
  key: string,
  maxAgeDays = 7,
  now = Date.now(),
): Draft | null {
  let raw: string | null = null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  const draft = parse(raw);
  if (!draft) return null;
  if (now - new Date(draft.savedAt).getTime() > maxAgeDays * DAY) {
    clearDraft(store, key);
    return null;
  }
  return draft;
}

/** Removes admin drafts older than `maxAgeDays`; other keys are left alone. */
export function pruneDrafts(store: Store, now: number, maxAgeDays = 7) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) readDraft(store, key, maxAgeDays, now);
  } catch {
    // ignore
  }
}

export { parse as parseDraft };
