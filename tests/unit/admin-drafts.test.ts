import { beforeEach, describe, expect, it } from "vitest";
import {
  clearDraft,
  draftKey,
  pruneDrafts,
  readDraft,
  saveDraft,
} from "@/lib/admin/drafts";

const day = 24 * 60 * 60 * 1000;

/** In-memory Storage: drafts take the store as a parameter, so tests need no browser. */
class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}
const localStorage = new MemoryStorage();

describe("drafts", () => {
  beforeEach(() => localStorage.clear());

  it("names drafts by table and item", () => {
    expect(draftKey("certificates", "new")).toBe(
      "admin.draft.certificates.new",
    );
  });

  it("saves, reads and clears a draft", () => {
    const key = draftKey("certificates", "x");
    saveDraft(localStorage, key, {
      values: { name: "A" },
      savedAt: new Date().toISOString(),
      baseSignature: "s",
    });
    expect(readDraft(localStorage, key)?.values).toEqual({ name: "A" });
    clearDraft(localStorage, key);
    expect(readDraft(localStorage, key)).toBeNull();
  });

  it("forgets drafts older than 7 days", () => {
    const key = draftKey("certificates", "old");
    saveDraft(localStorage, key, {
      values: {},
      savedAt: new Date(Date.now() - 8 * day).toISOString(),
      baseSignature: "s",
    });
    expect(readDraft(localStorage, key)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("prunes only old admin drafts", () => {
    localStorage.setItem("other", "keep");
    saveDraft(localStorage, draftKey("a", "1"), {
      values: {},
      savedAt: new Date(Date.now() - 9 * day).toISOString(),
      baseSignature: "",
    });
    saveDraft(localStorage, draftKey("a", "2"), {
      values: {},
      savedAt: new Date().toISOString(),
      baseSignature: "",
    });
    pruneDrafts(localStorage, Date.now());
    expect(localStorage.getItem("other")).toBe("keep");
    expect(localStorage.getItem(draftKey("a", "1"))).toBeNull();
    expect(localStorage.getItem(draftKey("a", "2"))).not.toBeNull();
  });

  it("ignores broken storage entries", () => {
    localStorage.setItem(draftKey("a", "bad"), "{not json");
    expect(readDraft(localStorage, draftKey("a", "bad"))).toBeNull();
  });
});
