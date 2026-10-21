/** Only local section/item anchors and supported locales, never redirect URLs. */
export function previewDestination(params: URLSearchParams): string {
  const locale = params.get("locale") ?? "en",
    target = params.get("target") ?? "hero";
  if (
    !["en", "ja", "vi"].includes(locale) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target)
  )
    throw new Error("Invalid preview destination");
  return `/${locale}#${target}`;
}
