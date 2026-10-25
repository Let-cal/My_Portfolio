"use client";

import { createContext, useContext } from "react";

type AccessKind = "admin" | "reviewer";

// Without a provider the screen is the admin's, so existing screens and tests stay unchanged.
const AccessContext = createContext<{ kind: AccessKind }>({ kind: "admin" });

/**
 * Who is looking at the admin, resolved on the server. Hiding write controls from the reviewer
 * is a convenience only: every write action checks again and returns FORBIDDEN.
 */
export function AdminAccessProvider({
  kind,
  children,
}: {
  kind: AccessKind;
  children: React.ReactNode;
}) {
  return <AccessContext value={{ kind }}>{children}</AccessContext>;
}

export function useAdminAccess(): { kind: AccessKind; readOnly: boolean } {
  const { kind } = useContext(AccessContext);
  return { kind, readOnly: kind !== "admin" };
}

/** Renders its children for the admin only (e.g. "Thêm mới" on server-rendered pages). */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  return useAdminAccess().readOnly ? null : children;
}
