"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type HighlightContextValue = {
  /** Element ids (`exp-<id>`, `proj-<id>`) that should currently glow. */
  ids: readonly string[];
  setIds: (ids: readonly string[]) => void;
};

const NONE: readonly string[] = [];
/** Without a provider (an isolated component test) nothing is highlighted and setIds does nothing. */
const HighlightContext = createContext<HighlightContextValue>({
  ids: NONE,
  setIds: () => {},
});

/**
 * Which experience / project elements are lit up. The skill map writes the evidence of the selected skill here;
 * the timeline and the project cards read it and set `data-highlight="true"` on their `#exp-*` / `#proj-*` element.
 * It carries no DOM access: the elements stay owned by their components.
 */
export function HighlightProvider({ children }: { children: ReactNode }) {
  const [ids, setIdsState] = useState<readonly string[]>(NONE);
  const setIds = useCallback(
    (next: readonly string[]) => setIdsState(next.length === 0 ? NONE : next),
    [],
  );
  const value = useMemo(() => ({ ids, setIds }), [ids, setIds]);
  return <HighlightContext value={value}>{children}</HighlightContext>;
}

export function useHighlight(): HighlightContextValue {
  return useContext(HighlightContext);
}

/** True while the element with this id (`exp-...` / `proj-...`) is highlighted. */
export function useIsHighlighted(elementId: string): boolean {
  return useContext(HighlightContext).ids.includes(elementId);
}
