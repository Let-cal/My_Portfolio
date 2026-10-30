// Where an admin item shows on the public site, for "Xem trên trang" and "Xem trước nội dung đã lưu".
import type { Content } from "@/content/schema";
import { featuredProjects } from "@/lib/featured";
import { journeyAnchors } from "@/lib/journey";
import type { ResourceKey } from "./resources";

/** A place on the public site: an element id on the home page or on the all-projects page. */
export type PublicTarget = { page: "home" | "projects"; anchor: string };

type Tree = Pick<Content, "experiences" | "education" | "projects">;

const home = (anchor: string): PublicTarget => ({ page: "home", anchor });

/**
 * Where the item shows, by the same rules as the site (skills evidence uses them too): a stint at its tree parent
 * `exp-<group slug>`, a school at its `exp-<school slug>`, a project the tree shows at `tree-<id>`, another project
 * with a home card at `proj-<id>`, any other project at its `row-<id>` on the all-projects page. Without `tree` (a
 * new item), or when the item is not on the page (hidden), it falls back to the section; the other lists always do.
 */
export function publicTarget(
  key: ResourceKey,
  id: string,
  tree?: Tree,
): PublicTarget {
  const anchors = tree ? journeyAnchors(tree as Content) : null;
  switch (key) {
    case "experiences":
      return home(anchors?.experiences.get(id) ?? "experience");
    case "education":
      return home(anchors?.education.get(id) ?? "experience");
    case "projects": {
      const inTree = anchors?.projects.get(id);
      if (inTree) return home(inTree);
      if (tree && featuredProjects(tree.projects).some((p) => p.id === id))
        return home(`proj-${id}`);
      return { page: "projects", anchor: `row-${id}` };
    }
    case "certificates":
    case "activities":
      return home("certificates");
    case "skills":
      return home("skills");
    case "why_cards":
      return home("why");
  }
}

/** The site path of a target, e.g. `/en#tree-siteplus` or `/en/projects#row-side-project`. */
export function publicPath(target: PublicTarget, locale = "en"): string {
  const page = target.page === "projects" ? "/projects" : "";
  return `/${locale}${page}#${encodeURIComponent(target.anchor)}`;
}

/** The public page on the same deployment as this admin (a preview links to that preview). */
export function publicUrl(target: PublicTarget, origin: string): string {
  return `${origin}${publicPath(target)}`;
}

/** The admin preview route for a target (draft mode on, then the page at that place). */
export function previewHref(target: PublicTarget, locale = "en"): string {
  const page = target.page === "projects" ? "&page=projects" : "";
  return `/admin/preview?locale=${locale}&target=${encodeURIComponent(target.anchor)}${page}`;
}
