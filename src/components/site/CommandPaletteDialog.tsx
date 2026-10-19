"use client";

import {
  DownloadIcon,
  HashIcon,
  LanguagesIcon,
  MonitorIcon,
  MoonIcon,
  PauseIcon,
  CopyIcon,
  SparklesIcon,
  SunIcon,
  TimerIcon,
  UserIcon,
} from "@/components/site/icons";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLE_KEYS } from "@/content/constants";
import type { RoleKey } from "@/content/schema";
import { getPathname, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getLenis, scrollToElement } from "./lenis-instance";
import {
  useMotionPreference,
  type MotionPreference,
} from "./motion-preference";
import { useRole } from "./RoleProvider";
import { SECTION_IDS, type SectionId } from "./sections";
import { useTheme, type Theme } from "./theme";
import { useCopyEmail } from "./use-copy-email";
import { isPaletteShortcut } from "./command-shortcut";
import { useShortcutHint } from "./use-shortcut-hint";

/** Wait this long for the dialog to hand focus back before running a deferred go-to anyway. */
const CLOSE_FALLBACK_MS = 400;

const MOTION_OPTIONS: { pref: MotionPreference; icon: ReactNode }[] = [
  { pref: "system", icon: <MonitorIcon aria-hidden /> },
  { pref: "on", icon: <SparklesIcon aria-hidden /> },
  { pref: "off", icon: <PauseIcon aria-hidden /> },
];

/** Moves keyboard focus to the section's heading (the reading position), without scrolling again. */
function focusHeading(id: SectionId) {
  const heading = document.getElementById(`${id}-heading`);
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}

/** Starts a download of `url` without leaving the page (cross-origin files ignore `download`, so open a new tab). */
function downloadFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.target = "_blank";
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
}

/**
 * The command palette dialog (loaded on demand by `CommandPalette`): jump to a section, switch role, language, theme or motion, download the CV,
 * copy the email, or open the 60-second view. Opens on the shortcut or on a `window` "open-command" event (the
 * header button fires it). Smooth scrolling pauses while it is open. Language changes are a full page load, as
 * in LanguageSwitch, because a soft navigation keeps the previous locale's page mounted.
 */
export function CommandPaletteDialog({
  cvUrls,
  email,
  initialOpen = false,
}: {
  cvUrls: Record<RoleKey, string>;
  email: string;
  /** The loader mounts the palette because the shortcut was pressed, so it must start open. */
  initialOpen?: boolean;
}) {
  const t = useTranslations("command");
  const tNav = useTranslations("nav");
  const tRoles = useTranslations("roles");
  const tLang = useTranslations("language");
  const tContact = useTranslations("contact");
  const locale = useLocale();
  const pathname = usePathname();
  const { role, setRole } = useRole();
  const { theme, setTheme } = useTheme();
  const { pref, setPref } = useMotionPreference();
  const { copy } = useCopyEmail(email, tContact("copied"));
  const shortcut = useShortcutHint();

  const [open, setOpen] = useState(initialOpen);
  // A go-to waits for the dialog to close so the focus it moves is not taken back by the dialog's focus return.
  const pending = useRef<(() => void) | null>(null);

  const flush = useCallback(() => {
    const run = pending.current;
    pending.current = null;
    run?.();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPaletteShortcut(event)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command", onOpen);
    };
  }, []);

  // The page behind must not scroll while the palette is open.
  useEffect(() => {
    if (!open) return;
    getLenis()?.stop();
    // Look the instance up again: choosing a motion command can destroy Lenis in the same update, and a destroyed one must not restart.
    return () => getLenis()?.start();
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const goTo = (id: SectionId) => {
    pending.current = () => {
      const section = document.getElementById(id);
      if (!section) return;
      scrollToElement(section);
      focusHeading(id);
    };
    setOpen(false);
    window.setTimeout(flush, CLOSE_FALLBACK_MS);
  };

  const switchLanguage = (next: string) => {
    setOpen(false);
    if (next === locale) return;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full page load, see LanguageSwitch
    window.location.assign(
      `${getPathname({ href: pathname, locale: next as (typeof routing.locales)[number] })}${window.location.search}${window.location.hash}`,
    );
  };

  const groupLabels = {
    goTo: t("groups.goTo"),
    role: t("groups.role"),
    language: t("groups.language"),
    theme: t("groups.theme"),
    motion: t("groups.motion"),
    actions: t("groups.actions"),
  };

  const themes: { value: Theme; label: string; icon: ReactNode }[] = [
    { value: "dark", label: t("theme.dark"), icon: <MoonIcon aria-hidden /> },
    { value: "light", label: t("theme.light"), icon: <SunIcon aria-hidden /> },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        data-lenis-prevent=""
        className="top-1/4 translate-y-0 overflow-hidden rounded-xl! p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          // Only take over the focus when a go-to is waiting; otherwise the dialog returns it to where it was.
          if (!pending.current) return;
          event.preventDefault();
          requestAnimationFrame(flush);
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Command label={t("inputLabel")}>
          <CommandInput placeholder={t("placeholder")} />
          <CommandList
            label={t("inputLabel")}
            className="max-h-[min(24rem,60svh)]"
          >
            <CommandEmpty>{t("empty")}</CommandEmpty>

            <CommandGroup heading={groupLabels.goTo}>
              {SECTION_IDS.map((id) => (
                <CommandItem
                  key={id}
                  value={`goto-${id}`}
                  keywords={[tNav(id), groupLabels.goTo]}
                  onSelect={() => goTo(id)}
                >
                  <HashIcon aria-hidden />
                  {tNav(id)}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading={groupLabels.role}>
              {ROLE_KEYS.map((key) => (
                <CommandItem
                  key={key}
                  value={`role-${key}`}
                  keywords={[tRoles(key), groupLabels.role]}
                  data-checked={role === key}
                  onSelect={() => run(() => setRole(key))}
                >
                  <UserIcon aria-hidden />
                  {tRoles(key)}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading={groupLabels.language}>
              {routing.locales.map((code) => (
                <CommandItem
                  key={code}
                  value={`language-${code}`}
                  keywords={[tLang(code), groupLabels.language]}
                  data-checked={code === locale}
                  onSelect={() => switchLanguage(code)}
                >
                  <LanguagesIcon aria-hidden />
                  <span lang={code}>{tLang(code)}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading={groupLabels.theme}>
              {themes.map(({ value, label, icon }) => (
                <CommandItem
                  key={value}
                  value={`theme-${value}`}
                  keywords={[label, groupLabels.theme]}
                  data-checked={theme === value}
                  onSelect={() => run(() => setTheme(value))}
                >
                  {icon}
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading={groupLabels.motion}>
              {MOTION_OPTIONS.map(({ pref: value, icon }) => (
                <CommandItem
                  key={value}
                  value={`motion-${value}`}
                  keywords={[t(`motion.${value}`), groupLabels.motion]}
                  data-checked={pref === value}
                  onSelect={() => run(() => setPref(value))}
                >
                  {icon}
                  {t(`motion.${value}`)}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading={groupLabels.actions}>
              {cvUrls[role] && (
                <CommandItem
                  value="action-cv"
                  keywords={[t("actions.downloadCv"), groupLabels.actions]}
                  onSelect={() => run(() => downloadFile(cvUrls[role]))}
                >
                  <DownloadIcon aria-hidden />
                  {t("actions.downloadCv")}
                </CommandItem>
              )}
              <CommandItem
                value="action-email"
                keywords={[t("actions.copyEmail"), groupLabels.actions]}
                onSelect={() => run(() => void copy())}
              >
                <CopyIcon aria-hidden />
                {t("actions.copyEmail")}
              </CommandItem>
              <CommandItem
                value="action-quick"
                keywords={[t("actions.quickView"), groupLabels.actions]}
                onSelect={() =>
                  run(() => {
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load of a different route
                    window.location.assign(`/${locale}/quick?role=${role}`);
                  })
                }
              >
                <TimerIcon aria-hidden />
                {t("actions.quickView")}
              </CommandItem>
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span>{t("hint")}</span>
            <kbd className="rounded border border-border px-1.5 py-0.5 font-sans">
              {shortcut}
            </kbd>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
