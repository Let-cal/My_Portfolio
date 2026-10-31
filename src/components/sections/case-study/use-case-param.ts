"use client";

import { useCallback, useEffect, useRef } from "react";
import { CASE_PARAM, parseCaseParam, type CaseContext } from "@/lib/case-list";

/** Lists that read `?case=` in this hydration pass; the first to know the id opens it (tree before bento). */
type Claim = { known: Set<string>; rank: number; open: (id: string) => void };
let claims: Claim[] = [];
let pending = false;
const RANK: Record<CaseContext, number> = { tree: 0, bento: 1, archive: 2 };

/** Rewrites `?case=` in place (no history entry), keeping the other params and the hash. */
function writeCase(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(CASE_PARAM, id);
  else url.searchParams.delete(CASE_PARAM);
  window.history.replaceState(null, "", url);
}

function settle() {
  pending = false;
  const { search } = window.location;
  const owner = claims
    .filter((c) => parseCaseParam(search, c.known))
    .sort((a, b) => a.rank - b.rank)[0];
  if (owner) owner.open(new URLSearchParams(search).get(CASE_PARAM)!);
  else if (new URLSearchParams(search).has(CASE_PARAM)) writeCase(null);
  claims = [];
}

/**
 * Deep link of the case study panel. Reads `?case=` once after hydration and opens it when `items` holds that id
 * (a list ranked earlier wins when two lists on the page hold it; an id no list knows is dropped from the URL).
 * Returns the setter to hand the panel: it updates `?case=` with `history.replaceState` on open, move and close.
 */
export function useCaseParam(
  items: { id: string }[],
  setOpenId: (id: string | null) => void,
  context: CaseContext,
): (id: string | null) => void {
  const latest = useRef({ items, setOpenId });
  useEffect(() => {
    latest.current = { items, setOpenId };
  });

  useEffect(() => {
    const claim: Claim = {
      known: new Set(latest.current.items.map((i) => i.id)),
      rank: RANK[context],
      open: (id) => latest.current.setOpenId(id),
    };
    claims.push(claim);
    if (!pending) {
      pending = true;
      requestAnimationFrame(settle);
    }
    return () => {
      claims = claims.filter((c) => c !== claim);
    };
  }, [context]);

  return useCallback(
    (id: string | null) => {
      writeCase(id);
      setOpenId(id);
    },
    [setOpenId],
  );
}
