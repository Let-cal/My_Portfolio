"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import type { RoleKey } from "@/content/schema";
import { ROLE_ACCENT } from "@/lib/role-accent";
import { DEFAULT_ROLE, parseRole } from "@/lib/roles";

type RoleContextValue = { role: RoleKey; setRole: (role: RoleKey) => void };

/** Without a provider (e.g. an isolated component test) the default role is used and setRole does nothing. */
const RoleContext = createContext<RoleContextValue>({ role: DEFAULT_ROLE, setRole: () => {} });

export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}

function createRoleStore() {
  let current: RoleKey = DEFAULT_ROLE;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next: RoleKey) {
      if (next === current) return;
      current = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Reads `?role=` and pushes it into the store. It is the only piece that suspends on
 * `useSearchParams`, so it sits in its own <Suspense> and the page content is never affected.
 */
function RoleUrlSync({ onRole }: { onRole: (role: RoleKey) => void }) {
  const role = parseRole(useSearchParams().get("role"));
  useEffect(() => {
    onRole(role);
  }, [role, onRole]);
  return null;
}

/**
 * Current role, kept in sync with `?role=`. The static HTML is rendered with the default role;
 * the URL value is applied right after hydration. `setRole` updates immediately, then rewrites the URL
 * with Next-integrated native history (no scroll or RSC refetch), keeping other query params and the hash. The role's accent colour is
 * written to `--role-accent` on <html>.
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createRoleStore);
  const role = useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_ROLE);

  const setRole = useCallback(
    (next: RoleKey) => {
      store.set(next);
      const params = new URLSearchParams(window.location.search);
      if (next === DEFAULT_ROLE) params.delete("role");
      else params.set("role", next);
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    },
    [store],
  );

  // The accent of the chosen role feeds every `var(--role-accent)` on the page (globals.css holds the default).
  useEffect(() => {
    document.documentElement.style.setProperty("--role-accent", ROLE_ACCENT[role]);
  }, [role]);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);

  return (
    <RoleContext value={value}>
      {children}
      <Suspense fallback={null}>
        <RoleUrlSync onRole={store.set} />
      </Suspense>
    </RoleContext>
  );
}
