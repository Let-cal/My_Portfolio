"use client";

import {
  Award,
  Briefcase,
  CalendarHeart,
  ExternalLink,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Images,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Star,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { Suspense, useId, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Tổng quan",
    items: [{ href: "/admin", label: "Tổng quan", icon: LayoutDashboard }],
  },
  {
    title: "Nội dung",
    items: [
      { href: "/admin/skills", label: "Kỹ năng", icon: Sparkles },
      { href: "/admin/experiences", label: "Vị trí làm việc", icon: Briefcase },
      { href: "/admin/projects", label: "Dự án", icon: FolderKanban },
      { href: "/admin/certificates", label: "Chứng chỉ", icon: Award },
      { href: "/admin/activities", label: "Hoạt động", icon: CalendarHeart },
      { href: "/admin/education", label: "Học vấn", icon: GraduationCap },
      { href: "/admin/why_cards", label: "Why hire me", icon: Star },
      { href: "/admin/media", label: "Thư viện media", icon: Images },
    ],
  },
  {
    title: "Hồ sơ & vai trò",
    items: [
      { href: "/admin/profile", label: "Hồ sơ", icon: UserRound },
      { href: "/admin/roles", label: "Vai trò & CV", icon: Users },
    ],
  },
];

// Collapsed state lives in localStorage; the server renders the sidebar expanded.
const KEY = "admin.sidebar";
const listeners = new Set<() => void>();
const readCollapsed = () => {
  try {
    return localStorage.getItem(KEY) === "collapsed";
  } catch {
    return false;
  }
};
function setCollapsed(value: boolean) {
  try {
    localStorage.setItem(KEY, value ? "collapsed" : "expanded");
  } catch {
    // Not remembered this time.
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The nav item for `pathname`: the longest matching href ("/admin" only on the dashboard itself). */
function activeHref(pathname: string): string | undefined {
  const all = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
  return all
    .filter((href) =>
      href === "/admin"
        ? pathname === "/admin"
        : pathname === href || pathname.startsWith(`${href}/`),
    )
    .sort((a, b) => b.length - a.length)[0];
}

type NavProps = {
  collapsed?: boolean;
  badge?: React.ReactNode;
  onNavigate?: () => void;
};

/**
 * The current path is request data, so with Cache Components it must be read inside Suspense;
 * the prerendered shell shows the same links without a highlight.
 */
function NavLinks(props: NavProps) {
  return (
    <Suspense fallback={<NavList {...props} />}>
      <CurrentNavList {...props} />
    </Suspense>
  );
}

function CurrentNavList(props: NavProps) {
  return <NavList {...props} active={activeHref(usePathname())} />;
}

function NavList({
  collapsed,
  badge,
  onNavigate,
  active,
}: NavProps & { active?: string }) {
  // The desktop sidebar and the mobile sheet each get their own sliding highlight.
  const layoutId = useId();
  return (
    <LayoutGroup id={layoutId}>
      <nav aria-label="Quản trị" className="isolate flex flex-col gap-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            {!collapsed && group.items.length > 1 && (
              <p className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.title}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const current = href === active;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={current ? "page" : undefined}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        current
                          ? "font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {current && (
                        <motion.span
                          layoutId="admin-nav-active"
                          aria-hidden
                          className="absolute inset-0 -z-10 rounded-md bg-primary/12"
                        />
                      )}
                      <Icon
                        aria-hidden
                        className={cn(
                          "size-4 shrink-0",
                          current && "text-primary",
                        )}
                      />
                      <span className={cn(collapsed && "sr-only")}>
                        {label}
                      </span>
                      {href === "/admin" && !collapsed && badge}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <Link
          href="/en"
          target="_blank"
          title={collapsed ? "Xem trang" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <ExternalLink aria-hidden className="size-4" />
          <span className={cn(collapsed && "sr-only")}>
            Xem trang công khai
          </span>
        </Link>
      </nav>
    </LayoutGroup>
  );
}

/** Desktop: sticky sidebar that collapses to icons. Mobile: a ☰ button opening a drawer. */
export function AdminSidebar({ badge }: { badge?: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-2 md:hidden">
        <Link href="/admin" className="text-base font-semibold">
          Letcal admin
        </Link>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Mở menu"
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden className="size-4" />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 overflow-y-auto p-4">
            <SheetTitle className="mb-4">Letcal admin</SheetTitle>
            <NavLinks badge={badge} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
      <aside
        className={cn(
          "sticky top-6 hidden shrink-0 flex-col gap-5 self-start md:flex",
          collapsed ? "w-10" : "w-52",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          {!collapsed && (
            <Link href="/admin" className="text-base font-semibold">
              Letcal admin
            </Link>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden className="size-4" />
            )}
          </Button>
        </div>
        <NavLinks collapsed={collapsed} badge={badge} />
      </aside>
    </>
  );
}
