// Where an admin item shows on the public site, for "Xem trên trang".
import type { ResourceKey } from "./resources";

/** The element id on the public page: the item itself where the site has one, else its section. */
export function publicAnchor(key: ResourceKey, id: string): string {
  switch (key) {
    case "experiences":
      return `exp-${id}`;
    case "projects":
      return `proj-${id}`;
    case "education":
      return `edu-${id}`;
    case "certificates":
    case "activities":
      return "certificates";
    case "skills":
      return "skills";
    case "why_cards":
      return "why";
  }
}

/** The public page on the same deployment as this admin (a preview links to that preview). */
export function publicUrl(
  key: ResourceKey,
  id: string,
  origin: string,
): string {
  return `${origin}/en#${encodeURIComponent(publicAnchor(key, id))}`;
}
