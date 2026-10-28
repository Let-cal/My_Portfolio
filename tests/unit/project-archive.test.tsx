import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi_ from "@/messages/vi.json";
import seed from "@/content/seed.json";
import {
  contentSchema,
  type Content,
  type Locale,
  type Project,
} from "@/content/schema";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/en/projects",
}));

import { ProjectArchive } from "@/components/sections/projects/ProjectArchive";
import { RoleProvider } from "@/components/site/RoleProvider";
import { RoleSwitcher } from "@/components/site/RoleSwitcher";
import sitemap from "@/app/sitemap";
import { archiveMetadata, archiveRows, parseKind } from "@/lib/archive";
import {
  ARCHIVE_FILTER_CSS,
  ARCHIVE_FILTER_SCRIPT,
  initialKind,
} from "@/lib/archive-filter";

const base: Content = contentSchema.parse(seed);
const messages = { en, ja, vi: vi_ };

const personal: Project = {
  ...base.projects[0],
  id: "side-project",
  title: "Side Project",
  start: "2026-06",
  end: null,
  kind: "personal",
  experienceId: null,
  educationId: null,
  featured: false,
  featuredOrder: null,
  caseStudy: null,
  roles: ["fullstack"],
  sortIndex: 99,
};
const withPersonal: Content = {
  ...base,
  projects: [...base.projects, personal],
};

function renderArchive(
  opts: {
    content?: Content;
    locale?: Locale;
    role?: string;
    withSwitcher?: boolean;
  } = {},
) {
  search.value = opts.role ? `role=${opts.role}` : "";
  const locale = opts.locale ?? "en";
  const rows = archiveRows(opts.content ?? base, locale);
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <RoleProvider>
        {opts.withSwitcher && <RoleSwitcher />}
        <ProjectArchive rows={rows} />
      </RoleProvider>
    </NextIntlClientProvider>,
  );
}

const rowIds = () =>
  [...document.querySelectorAll<HTMLElement>("tr[id^='row-']")].map(
    (n) => n.id,
  );
const visibleRowIds = () =>
  [...document.querySelectorAll<HTMLElement>("tr[id^='row-']")]
    .filter((n) => getComputedStyle(n).display !== "none")
    .map((n) => n.id);
const chip = (name: RegExp) => screen.getByRole("button", { name });

let style: HTMLStyleElement;
beforeEach(() => {
  window.history.replaceState(null, "", "/en/projects");
  style = document.createElement("style");
  style.textContent = ARCHIVE_FILTER_CSS;
  document.head.append(style);
});
afterEach(() => {
  style.remove();
  vi.unstubAllEnvs();
});

describe("archiveRows", () => {
  it("rows sorted by start desc with where = company/school/Personal", () => {
    const rows = archiveRows(withPersonal, "en");
    expect(rows.map((r) => r.id)).toEqual([
      "side-project",
      "skg-ai-agent",
      "skg-flexybox-p2",
      "skg-coa",
      "skg-flexybox-p1",
      "tongue-ai-driver-ms",
      "siteplus",
      "zodiacgems",
      "meet-my-lecturer",
    ]);
    const where = Object.fromEntries(rows.map((r) => [r.id, r.where]));
    expect(where["skg-coa"]).toBe("SKG Software (Splus)");
    expect(where["siteplus"]).toBe("FPT University");
    expect(where["side-project"]).toBe("Personal");
    expect(rows.find((r) => r.id === "skg-coa")).toMatchObject({
      year: "2025",
      whereKind: "work",
      featured: false,
    });
    expect(rows.find((r) => r.id === "siteplus")).toMatchObject({
      whereKind: "university",
      featured: true,
      demoUrl: "https://site-plus-fe.vercel.app",
    });
  });

  it("localizes the Personal label and the role, falling back to EN", () => {
    const rows = archiveRows(withPersonal, "ja");
    expect(rows[0].where).toBe(ja.archive.personal);
    expect(rows[0].where).not.toBe("Personal");
    expect(archiveRows(withPersonal, "vi")[0].where).toBe(vi_.archive.personal);
  });

  it("lists only published projects", () => {
    const content: Content = {
      ...base,
      projects: base.projects.map((p) =>
        p.id === "skg-coa" ? { ...p, published: false } : p,
      ),
    };
    expect(archiveRows(content, "en").map((r) => r.id)).not.toContain(
      "skg-coa",
    );
  });

  it("keeps a published project whose stint is unpublished, named after its company", () => {
    const content: Content = {
      ...base,
      experiences: base.experiences.map((e) =>
        e.id === "skg-intern" ? { ...e, published: false } : e,
      ),
    };
    expect(
      archiveRows(content, "en").find((r) => r.id === "skg-flexybox-p1")?.where,
    ).toBe("SKG Software (Splus)");
  });
});

describe("parseKind", () => {
  it("parseKind('bogus') === 'all'", () => {
    expect(parseKind("bogus")).toBe("all");
    expect(parseKind(null)).toBe("all");
    expect(parseKind("")).toBe("all");
    expect(parseKind("WORK")).toBe("all");
  });

  it("keeps the three kinds", () => {
    expect(parseKind("work")).toBe("work");
    expect(parseKind("university")).toBe("university");
    expect(parseKind("personal")).toBe("personal");
    expect(parseKind("all")).toBe("all");
  });
});

describe("initial filter on load", () => {
  const kindOf = (id: string) =>
    ({ "row-skg-coa": "work", "row-siteplus": "university" })[id] ?? null;

  it("uses ?kind= unless the hash targets a row that kind hides", () => {
    expect(initialKind("?kind=work", "", kindOf)).toBe("work");
    expect(initialKind("?kind=bogus", "", kindOf)).toBe("all");
    expect(initialKind("?kind=work", "#row-skg-coa", kindOf)).toBe("work");
    expect(initialKind("?kind=work", "#row-siteplus", kindOf)).toBe("all");
    expect(initialKind("?kind=work", "#row-%E0%A4%A", kindOf)).toBe("work");
  });

  it("the pre-paint script applies the same rule to the server HTML", () => {
    renderArchive();
    const wrap = () =>
      document
        .querySelector("[data-archive-rows]")!
        .getAttribute("data-archive-filter");
    const cases: [string, string | null][] = [
      ["?kind=university", "university"],
      ["?kind=university#row-skg-coa", null],
      ["?kind=bogus", null],
      ["?kind=work#row-skg-coa", "work"],
    ];
    for (const [url, expected] of cases) {
      document
        .querySelector("[data-archive-rows]")!
        .removeAttribute("data-archive-filter");
      window.history.replaceState(null, "", `/en/projects${url}`);
      new Function(ARCHIVE_FILTER_SCRIPT)();
      expect(wrap(), url).toBe(expected);
    }
  });
});

describe("ProjectArchive", () => {
  it("every published project has a row-<id> target for the skills evidence links", () => {
    renderArchive({ content: withPersonal });
    expect(rowIds().sort()).toEqual(
      withPersonal.projects
        .filter((p) => p.published)
        .map((p) => `row-${p.id}`)
        .sort(),
    );
  });

  it("is a table with the six column headers", () => {
    renderArchive();
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(Object.values(en.archive.columns));
  });

  it("filter chips update ?kind and the visible rows", async () => {
    const user = userEvent.setup();
    renderArchive({ content: withPersonal });
    expect(chip(/^All/)).toHaveAttribute("aria-pressed", "true");
    expect(visibleRowIds()).toHaveLength(9);

    await user.click(chip(/^University/));
    expect(chip(/^University/)).toHaveAttribute("aria-pressed", "true");
    expect(chip(/^All/)).toHaveAttribute("aria-pressed", "false");
    expect(window.location.search).toBe("?kind=university");
    expect(visibleRowIds()).toEqual([
      "row-siteplus",
      "row-zodiacgems",
      "row-meet-my-lecturer",
    ]);

    await user.click(chip(/^Personal/));
    expect(window.location.search).toBe("?kind=personal");
    expect(visibleRowIds()).toEqual(["row-side-project"]);

    await user.click(chip(/^All/));
    expect(window.location.search).toBe("");
    expect(visibleRowIds()).toHaveLength(9);
  });

  it("chips show the count of each kind", () => {
    renderArchive({ content: withPersonal });
    expect(chip(/^All/)).toHaveTextContent("9");
    expect(chip(/^Work/)).toHaveTextContent("5");
    expect(chip(/^University/)).toHaveTextContent("3");
    expect(chip(/^Personal/)).toHaveTextContent("1");
  });

  it("starts from ?kind= in the URL and keeps other params", async () => {
    window.history.replaceState(null, "", "/en/projects?role=pm&kind=work");
    const user = userEvent.setup();
    renderArchive();
    await waitFor(() =>
      expect(chip(/^Work/)).toHaveAttribute("aria-pressed", "true"),
    );
    expect(visibleRowIds()).toEqual([
      "row-skg-ai-agent",
      "row-skg-flexybox-p2",
      "row-skg-coa",
      "row-skg-flexybox-p1",
      "row-tongue-ai-driver-ms",
    ]);
    await user.click(chip(/^All/));
    expect(window.location.search).toBe("?role=pm");
  });

  it("an unknown ?kind= shows every row", async () => {
    window.history.replaceState(null, "", "/en/projects?kind=bogus");
    renderArchive();
    await waitFor(() =>
      expect(chip(/^All/)).toHaveAttribute("aria-pressed", "true"),
    );
    expect(visibleRowIds()).toHaveLength(8);
  });

  it("a #row- deep link that the filter would hide resets the filter to all and scrolls to the row", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.history.replaceState(
      null,
      "",
      "/en/projects?kind=university#row-skg-coa",
    );
    renderArchive();
    await waitFor(() =>
      expect(chip(/^All/)).toHaveAttribute("aria-pressed", "true"),
    );
    expect(visibleRowIds()).toContain("row-skg-coa");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#row-skg-coa");
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts[0]).toBe(
      document.getElementById("row-skg-coa"),
    );
  });

  it("a hashchange to a row the current filter hides shows it before scrolling to it", async () => {
    const user = userEvent.setup();
    renderArchive();
    await user.click(chip(/^University/));
    expect(visibleRowIds()).not.toContain("row-skg-coa");
    const seen: string[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      seen.push(`${this.id}:${getComputedStyle(this).display}`);
    });
    // Make the frame run right away, so a filter applied any later than the hashchange itself would be missed.
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        cb(0);
        return 0;
      });
    act(() => {
      window.history.replaceState(
        null,
        "",
        "/en/projects?kind=university#row-skg-coa",
      );
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    raf.mockRestore();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/^row-skg-coa:/);
    expect(seen[0]).not.toBe("row-skg-coa:none");
    expect(chip(/^All/)).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toBe("");
  });

  it("a site navigation section link (#skills) loads the home page at that section, keeping the role", async () => {
    const replace = vi.fn();
    const real = window.location;
    vi.stubGlobal("location", {
      ...real,
      pathname: "/en/projects",
      search: "?role=pm&kind=work",
      hash: "#skills",
      replace,
    });
    renderArchive();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/en?role=pm#skills"),
    );
    vi.unstubAllGlobals();
  });

  it("row Enter opens the case study", async () => {
    const user = userEvent.setup();
    renderArchive();
    const row = document.getElementById("row-skg-coa")!;
    const button = within(row).getByRole("button", { name: /COA/ });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    button.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    const cs = base.projects.find((p) => p.id === "skg-coa")!.caseStudy!;
    expect(within(dialog).getByText(cs.problem.en)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(button).toHaveFocus();
  });

  it("a row without a case study has no button", () => {
    renderArchive();
    const row = document.getElementById("row-zodiacgems")!;
    expect(within(row).queryByRole("button")).toBeNull();
    expect(row).toHaveTextContent("ZodiacGems");
  });

  it("marks featured projects with a labelled star", () => {
    renderArchive();
    expect(
      within(document.getElementById("row-siteplus")!).getByText(
        new RegExp(en.archive.featured),
      ),
    ).toBeInTheDocument();
    expect(
      within(document.getElementById("row-skg-coa")!).queryByText(
        new RegExp(en.archive.featured),
      ),
    ).toBeNull();
  });

  it("rows whose roles include the selected role get data-highlight, order unchanged", async () => {
    const user = userEvent.setup();
    renderArchive({ withSwitcher: true });
    const order = rowIds();
    const lit = () =>
      [...document.querySelectorAll("tr[data-highlight='true']")].map(
        (n) => n.id,
      );
    expect(lit()).toEqual([
      "row-skg-coa",
      "row-skg-flexybox-p1",
      "row-zodiacgems",
      "row-meet-my-lecturer",
    ]);
    await user.click(screen.getByRole("radio", { name: "Project Manager" }));
    expect(lit()).toEqual([
      "row-skg-ai-agent",
      "row-skg-flexybox-p2",
      "row-skg-flexybox-p1",
    ]);
    expect(rowIds()).toEqual(order);
  });

  it("links open in a new tab with labelled repos", () => {
    renderArchive();
    const row = document.getElementById("row-siteplus")!;
    const links = within(row).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://site-plus-fe.vercel.app",
      ...base.projects.find((p) => p.id === "siteplus")!.repoUrls,
    ]);
    for (const a of links) expect(a).toHaveAttribute("target", "_blank");
  });

  it("has Japanese labels", () => {
    renderArchive({ locale: "ja" });
    expect(chip(new RegExp(`^${ja.archive.kinds.university}`))).toBeVisible();
    expect(
      within(screen.getByRole("table"))
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(Object.values(ja.archive.columns));
  });

  it("announces the number of shown rows", async () => {
    const user = userEvent.setup();
    renderArchive();
    await user.click(chip(/^University/));
    await act(async () => {});
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 3 of 8 projects",
    );
  });
});

describe("archive SEO", () => {
  beforeEach(() =>
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://letcal.is-a.dev"),
  );

  it("metadata has canonical and hreflang for en/ja/vi", () => {
    for (const locale of ["en", "ja", "vi"] as const) {
      const metadata = archiveMetadata(locale);
      expect(metadata.title).toBe(messages[locale].archive.metaTitle);
      expect(metadata.description).toBe(messages[locale].archive.description);
      expect(metadata.alternates).toMatchObject({
        canonical: `/${locale}/projects`,
        languages: {
          en: "/en/projects",
          ja: "/ja/projects",
          vi: "/vi/projects",
          "x-default": "/en/projects",
        },
      });
      expect(metadata.openGraph).toMatchObject({ url: `/${locale}/projects` });
      const image = {
        url: `/${locale}/opengraph-image`,
        width: 1200,
        height: 630,
        type: "image/png",
      };
      expect(metadata.openGraph?.images).toEqual([
        expect.objectContaining(image),
      ]);
      expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
      expect(metadata.twitter?.images).toEqual([
        expect.objectContaining(image),
      ]);
    }
  });

  it("sitemap lists /en/projects /ja/projects /vi/projects", () => {
    const urls = sitemap().map(({ url }) => url);
    for (const locale of ["en", "ja", "vi"])
      expect(urls).toContain(`https://letcal.is-a.dev/${locale}/projects`);
    const entry = sitemap().find((e) => e.url.endsWith("/ja/projects"))!;
    expect(entry.alternates?.languages).toMatchObject({
      en: "https://letcal.is-a.dev/en/projects",
      vi: "https://letcal.is-a.dev/vi/projects",
    });
  });
});
