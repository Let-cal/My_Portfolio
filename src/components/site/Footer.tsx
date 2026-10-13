import { cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getContent } from "@/lib/data/get-content";
import { FooterPrinciples } from "./FooterPrinciples";

/** The year is read inside a cache scope so the static shell can include it (see `cacheComponents`). */
async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export async function Footer() {
  const t = await getTranslations("footer");
  const { profile } = await getContent();

  const links = [
    { label: t("github"), href: profile.github },
    { label: t("linkedin"), href: profile.linkedin },
    { label: t("email"), href: `mailto:${profile.email}` },
  ];

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-6 sm:px-6">
        <FooterPrinciples />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © <CurrentYear /> {profile.name}. {t("rights")}
        </p>
        <nav aria-label={t("links")}>
          <ul className="flex items-center gap-4">
            {links.map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
