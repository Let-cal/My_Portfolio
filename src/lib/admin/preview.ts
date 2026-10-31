/** Only local section/item anchors on the home page or the all-projects page, supported locales, never redirect URLs. */
export function previewDestination(params: URLSearchParams): string {
  const locale = params.get("locale") ?? "en",
    target = params.get("target") ?? "hero",
    page = params.get("page") ?? "";
  if (
    !["en", "ja", "vi"].includes(locale) ||
    !["", "projects"].includes(page) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target)
  )
    throw new Error("Invalid preview destination");
  return `/${locale}${page ? `/${page}` : ""}#${target}`;
}
