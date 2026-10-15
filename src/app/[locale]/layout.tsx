import type { Metadata } from "next";
import { Inter, Instrument_Serif, Space_Grotesk } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { GrainOverlay } from "@/components/fx/GrainOverlay";
import { Spotlight } from "@/components/fx/Spotlight";
import { CommandPalette } from "@/components/site/CommandPalette";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { HelloIntro } from "@/components/site/HelloIntro";
import { JapaneseTypography } from "@/components/site/JapaneseTypography";
import { AccentTypography } from "@/components/site/AccentTypography";
import { HighlightProvider } from "@/components/site/HighlightProvider";
import { HELLO_SEEN_SCRIPT } from "@/components/site/hello-script";
import { NO_SCRIPT_REDUCED_MOTION_CSS, REVEAL_SHOW_CSS } from "@/components/site/reveal-style";
import { PillNav } from "@/components/site/PillNav";
import { RoleProvider } from "@/components/site/RoleProvider";
import { ScrollProgressKoi } from "@/components/site/ScrollProgressKoi";
import { SideRail } from "@/components/site/SideRail";
import { SmoothScroll } from "@/components/site/SmoothScroll";
import { MotionProvider } from "@/components/site/MotionProvider";
import { MOTION_INIT_SCRIPT } from "@/components/site/motion-script";
import { ThemeSync } from "@/components/site/ThemeSync";
import { THEME_INIT_SCRIPT } from "@/components/site/theme-script";
import { ROLE_KEYS } from "@/content/schema";
import { routing } from "@/i18n/routing";
import { getContent } from "@/lib/data/get-content";
import { pickLocale } from "@/lib/i18n-text";
import { DeferredToaster } from "@/components/site/DeferredToaster";
import "../globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "vietnamese"], display: "optional" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin", "vietnamese"], display: "optional" });
// Accent faces: the italic serif (role title in the side rail, later headings) and the Mincho used by the vertical chapter labels.
const instrumentSerif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: "italic", display: "optional" });

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
    "flex min-h-full flex-col",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang={locale} className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: MOTION_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: HELLO_SEEN_SCRIPT }} />
        {/* <Reveal> blocks are server-rendered hidden; without JavaScript nothing would ever show them. */}
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: REVEAL_SHOW_CSS + NO_SCRIPT_REDUCED_MOTION_CSS }} />
        </noscript>
      </head>
      <body className={bodyClassName}>
        <NextIntlClientProvider>
          <ThemeSync />
          <AccentTypography />
          {locale === "ja" && <JapaneseTypography />}
          <MotionProvider>
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
              <div data-site-shell="" className="relative z-10 flex flex-1 flex-col pt-14 pb-24 lg:grid lg:grid-cols-[minmax(17rem,30%)_minmax(0,1fr)] lg:pt-0 lg:pb-0">
                <SideRail name={profile.name} titles={titles} links={{ github: profile.github, linkedin: profile.linkedin, email: profile.email }} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-1 flex-col">
                    <HighlightProvider>{children}</HighlightProvider>
                  </div>
                  <Footer />
                </div>
              </div>
              <PillNav />
              <DeferredToaster />
              <SmoothScroll />
              <CommandPalette cvUrls={cvUrls} email={profile.email} />
              <Spotlight />
              <GrainOverlay />
              <ScrollProgressKoi />
              <HelloIntro />
            </RoleProvider>
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
