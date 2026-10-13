import type { Metadata } from "next";
import { Inter, Instrument_Serif, Noto_Sans_JP, Shippori_Mincho, Space_Grotesk } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GrainOverlay } from "@/components/fx/GrainOverlay";
import { Spotlight } from "@/components/fx/Spotlight";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { HelloIntro } from "@/components/site/HelloIntro";
import { HELLO_SEEN_SCRIPT } from "@/components/site/hello-script";
import { PillNav } from "@/components/site/PillNav";
import { RoleProvider } from "@/components/site/RoleProvider";
import { ScrollProgressKoi } from "@/components/site/ScrollProgressKoi";
import { SideRail } from "@/components/site/SideRail";
import { ThemeSync } from "@/components/site/ThemeSync";
import { THEME_INIT_SCRIPT } from "@/components/site/theme-script";
import { ROLE_KEYS } from "@/content/schema";
import { routing } from "@/i18n/routing";
import { getContent } from "@/lib/data/get-content";
import { pickLocale } from "@/lib/i18n-text";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "vietnamese"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin", "vietnamese"], display: "swap" });
// Only attached to <html> on /ja. The font is split by unicode-range, so only the glyphs used are fetched.
const notoSansJp = Noto_Sans_JP({ variable: "--font-noto-sans-jp", subsets: ["latin"], display: "swap", preload: false });
// Accent faces: the italic serif (role title in the side rail, later headings) and the Mincho used by the vertical chapter labels.
const instrumentSerif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: "italic", display: "swap" });
const shipporiMincho = Shippori_Mincho({ variable: "--font-mincho", subsets: ["latin"], weight: "500", display: "swap", preload: false });

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
  const { profile, roles } = await getContent();
  const roleOf = (key: (typeof ROLE_KEYS)[number]) => roles.find((r) => r.key === key);
  const titles = Object.fromEntries(ROLE_KEYS.map((key) => [key, pickLocale(roleOf(key)?.title, locale)])) as Record<(typeof ROLE_KEYS)[number], string>;
  const cvUrls = Object.fromEntries(ROLE_KEYS.map((key) => [key, roleOf(key)?.cvFileUrl ?? ""])) as Record<(typeof ROLE_KEYS)[number], string>;

  // <html> gets the same class string on every locale because the theme script edits `dark`/`light`
  // there and React only rewrites `className` when the prop changes. A locale switch still creates a
  // fresh <html> (new root layout), which <ThemeSync> fixes. Font variables live on <body>.
  const bodyClassName = [
    inter.variable,
    spaceGrotesk.variable,
    instrumentSerif.variable,
    shipporiMincho.variable,
    locale === "ja" ? notoSansJp.variable : "",
    "flex min-h-full flex-col",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang={locale} className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: HELLO_SEEN_SCRIPT }} />
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
            <Header cvUrls={cvUrls} />
            {/* z-10 keeps the content above the pointer spotlight (z-0) and the 3D canvas (z-index -1).
                From 1024px: rail (30%) | content (70%). Below that the rail is hidden and the pill nav shows. */}
            <div className="relative z-10 flex flex-1 flex-col pt-14 pb-24 lg:grid lg:grid-cols-[minmax(17rem,30%)_minmax(0,1fr)] lg:pt-0 lg:pb-0">
              <SideRail name={profile.name} titles={titles} links={{ github: profile.github, linkedin: profile.linkedin, email: profile.email }} />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-1 flex-col">{children}</div>
                <Footer />
              </div>
            </div>
            <PillNav />
            <Toaster />
            <Spotlight />
            <GrainOverlay />
            <ScrollProgressKoi />
            <HelloIntro />
          </RoleProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
