"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureToaster } from "./toast-readiness";

const COPIED_MS = 2000;

/**
 * Copy-to-clipboard for the public email: `copied` is true for 2 s (inline confirmation) and a toast says so
 * too. Without a usable clipboard (insecure context, denied permission) it opens the mail client instead.
 */
export function useCopyEmail(email: string, copiedLabel: string) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      // Inline confirmation is already visible; optional toast failure must not undo a successful copy.
      void Promise.all([ensureToaster(), import("sonner")])
        .then(([, { toast }]) => toast(copiedLabel, { description: email }))
        .catch(() => {});
    } catch {
      window.location.href = `mailto:${email}`;
    }
  }, [email, copiedLabel]);

  return { copied, copy };
}
