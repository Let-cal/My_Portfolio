import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Admin · Letcal", template: "%s · Admin · Letcal" },
  robots: { index: false, follow: false },
};

/** Separate root layout: the admin area has no locale, scene or site chrome. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-motion="reduced">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
