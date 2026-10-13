import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Space_Grotesk } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { RoleProvider } from "@/components/site/RoleProvider";
import { ThemeSync } from "@/components/site/ThemeSync";
import { THEME_INIT_SCRIPT } from "@/components/site/theme-script";
import { routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "vietnamese"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin", "vietnamese"], display: "swap" });
// Only attached to <html> on /ja. The font is split by unicode-range, so only the glyphs used are fetched.
const notoSansJp = Noto_Sans_JP({ variable: "--font-noto-sans-jp", subsets: ["latin"], display: "swap", preload: false });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("header");

  // <html> gets the same class string on every locale because the theme script edits `dark`/`light`
  // there and React only rewrites `className` when the prop changes. A locale switch still creates a
  // fresh <html> (new root layout), which <ThemeSync> fixes. Font variables live on <body>.
  const bodyClassName = [inter.variable, spaceGrotesk.variable, locale === "ja" ? notoSansJp.variable : "", "flex min-h-full flex-col"]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang={locale} className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={bodyClassName}>
        <NextIntlClientProvider>
          <ThemeSync />
          <RoleProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
            >
              {t("skipToContent")}
            </a>
            <Header />
            <div className="flex flex-1 flex-col pt-14">{children}</div>
            <Footer />
            <Toaster />
          </RoleProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
