const MOBILE = /mobile|android|(^|[^a-z])(mb|ios)([^a-z]|$)/i;
const WEB = /(^|[^a-z])(fe|web|frontend)([^a-z]|$)/i;

/** The `projects` message keys a repo label is made of. */
type RepoLabel = (
  key: "code" | "codeWeb" | "codeMobile" | "codeN",
  values?: { n: number },
) => string;

/** Labels the repos of one project: "Code" for a single one, "Code (Web)" / "Code (Mobile)" when the repo name says which, else "Code 1", "Code 2". */
export function repoLinks(
  urls: string[],
  t: RepoLabel,
): { url: string; label: string }[] {
  if (urls.length === 1) return [{ url: urls[0], label: t("code") }];
  const kinds = urls.map((url) => {
    const name = url.split("/").filter(Boolean).at(-1) ?? "";
    return MOBILE.test(name) ? "mobile" : WEB.test(name) ? "web" : null;
  });
  const anyMobile = kinds.includes("mobile");
  const anyWeb = kinds.includes("web");
  return urls.map((url, i) => {
    // A repo with no hint next to a mobile repo is the web one (and the other way round).
    const kind =
      kinds[i] ??
      (anyMobile && !anyWeb ? "web" : anyWeb && !anyMobile ? "mobile" : null);
    const label =
      kind === "web"
        ? t("codeWeb")
        : kind === "mobile"
          ? t("codeMobile")
          : t("codeN", { n: i + 1 });
    return { url, label };
  });
}
