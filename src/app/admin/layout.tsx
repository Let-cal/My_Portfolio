import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/components/site/theme-script";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Admin · Letcal", template: "%s · Admin · Letcal" },
  robots: { index: false, follow: false },
};

/**
 * Separate root layout: the admin area has no locale, scene or site chrome. It shares the
 * site's light/dark preference (same storage key), applied before first paint.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-motion="full" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* The admin follows the system motion setting (the site's Motion toggle is not used here). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'document.documentElement.dataset.motion=matchMedia("(prefers-reduced-motion: reduce)").matches?"reduced":"full"',
          }}
        />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
