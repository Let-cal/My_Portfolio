import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../../scripts/measure-initial-js.mjs", import.meta.url),
);

test(
  "first-paint styles arrive in the HTML without an external stylesheet waterfall",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const head = readFileSync(".next/server/app/en.html", "utf8").split(
      "</head>",
    )[0];
    assert.match(head, /<style\b[\s\S]*\.hero-disc/);
    const stylesheets = [...head.matchAll(/<link\b[^>]*>/g)].filter(
      ([tag]) =>
        /rel="stylesheet"/.test(tag) && tag.includes("/_next/static/css/"),
    );
    assert.equal(stylesheets.length, 0);
  },
);

test(
  "desktop scene input and text-veil code stay out of initial scripts",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const code = readFileSync(
        join(".next", decodeURIComponent(src.replace(/^\/_next\//, ""))),
        "utf8",
      );
      assert.equal(
        code.includes('"data-koi-veil"'),
        false,
        `${src} loads desktop scene protection eagerly`,
      );
    }
  },
);

test(
  "initial translations omit the build-time ICU parser",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const code = readFileSync(
        join(".next", decodeURIComponent(src.replace(/^\/_next\//, ""))),
        "utf8",
      );
      assert.equal(
        code.includes("EXPECT_ARGUMENT_CLOSING_BRACE"),
        false,
        `${src} includes the ICU parser`,
      );
    }
  },
);

test(
  "imperative animation is loaded on interaction rather than in initial scripts",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const code = readFileSync(
        join(".next", decodeURIComponent(src.replace(/^\/_next\//, ""))),
        "utf8",
      );
      assert.equal(
        code.includes("no-valid-elements"),
        false,
        `${src} loads the imperative animation dispatcher`,
      );
    }
  },
);

test(
  "below-fold scroll animation hooks are not startup dependencies",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const code = readFileSync(
        join(".next", decodeURIComponent(src.replace(/^\/_next\//, ""))),
        "utf8",
      );
      assert.equal(
        code.includes("Target ref is defined but not hydrated"),
        false,
        `${src} loads scroll hooks before they are needed`,
      );
    }
  },
);

test(
  "optimized hero portraits do not ship the client image component",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const code = readFileSync(
        join(".next", decodeURIComponent(src.replace(/^\/_next\//, ""))),
        "utf8",
      );
      assert.equal(
        code.includes("ImageConfigContext"),
        false,
        `${src} ships the client image runtime`,
      );
    }
    const html = readFileSync(".next/server/app/en.html", "utf8");
    assert.match(
      html,
      /srcSet="[^\"]*\/images\/roles\/optimized\/role-developer-384\.avif 384w/,
    );
  },
);

test(
  "selection-only skill beams are deferred",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const code = readFileSync(
        join(".next", decodeURIComponent(src.replace(/^\/_next\//, ""))),
        "utf8",
      );
      assert.equal(
        code.includes("--beam-delay"),
        false,
        `${src} loads beams before a skill is selected`,
      );
    }
  },
);

test(
  "Why artwork is rendered on the server rather than shipped as client JSX",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const code = readFileSync(
        join(".next", decodeURIComponent(src.replace(/^\/_next\//, ""))),
        "utf8",
      );
      assert.equal(
        code.includes("why-wave-svg"),
        false,
        `${src} ships static wave markup`,
      );
    }
    assert.match(
      readFileSync(".next/server/app/en.html", "utf8"),
      /why-wave-svg/,
    );
  },
);

test(
  "project static presentation stays in server HTML",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const code = readFileSync(
        join(".next", decodeURIComponent(src.replace(/^\/_next\//, ""))),
        "utf8",
      );
      assert.equal(
        code.includes("md:aspect-auto md:min-h-72"),
        false,
        `${src} ships static project presentation`,
      );
    }
    assert.match(
      readFileSync(".next/server/app/en.html", "utf8"),
      /md:aspect-auto md:min-h-72/,
    );
  },
);

test(
  "inline icons omit the generic icon builder",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const code = readFileSync(
        join(".next", decodeURIComponent(src.replace(/^\/_next\//, ""))),
        "utf8",
      );
      assert.equal(
        code.includes("includeDefaultClasses"),
        false,
        `${src} ships the unused icon builder`,
      );
    }
  },
);

test(
  "critical typography does not schedule a late swap on slow connections",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const html = readFileSync(".next/server/app/en.html", "utf8");
    for (const tag of html.matchAll(/<link\b[^>]*>/g)) {
      if (!tag[0].includes('rel="stylesheet"')) continue;
      const href = tag[0].match(/href="([^"]+)"/)?.[1];
      if (!href?.startsWith("/_next/static/")) continue;
      const css = readFileSync(
        join(".next", decodeURIComponent(href.replace(/^\/_next\//, ""))),
        "utf8",
      );
      for (const face of css.matchAll(/@font-face\{([^}]+)\}/g)) {
        if (!face[1].includes("src:url(")) continue;
        assert.equal(
          face[1].includes("font-display:optional"),
          true,
          `${href} permits a delayed font swap`,
        );
      }
    }
  },
);

test(
  "quick-view buttons do not pull unrelated Radix Select code into startup",
  { skip: !existsSync(".next/server/app/en/quick.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en/quick", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const path = join(
        ".next",
        decodeURIComponent(src.replace(/^\/_next\//, "")),
      );
      assert.equal(
        readFileSync(path, "utf8").includes("SelectScrollDownButton"),
        false,
        `${src} eagerly loads unused Select components`,
      );
    }
  },
);

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), "letcal-budget-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true });
  }
}

test("modern initial JS excludes nomodule and deduplicates preloaded scripts", () =>
  fixture((root) => {
    mkdirSync(join(root, ".next/server/app"), { recursive: true });
    mkdirSync(join(root, ".next/static/chunks/app/[locale]"), {
      recursive: true,
    });
    writeFileSync(
      join(root, ".next/static/chunks/app/[locale]/page.js"),
      "console.log('modern')",
    );
    writeFileSync(
      join(root, ".next/static/chunks/legacy.js"),
      "console.log('legacy')",
    );
    writeFileSync(
      join(root, ".next/server/app/en.html"),
      '<script src="/_next/static/chunks/legacy.js" noModule=""></script><script src="/_next/static/chunks/app/%5Blocale%5D/page.js"></script><link as="script" rel="preload" href="/_next/static/chunks/app/%5Blocale%5D/page.js">',
    );
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const [{ chunks }] = JSON.parse(result.stdout);
    assert.deepEqual(
      chunks.map(({ src }) => src),
      ["/_next/static/chunks/app/%5Blocale%5D/page.js"],
    );
  }));

test("budget verification fails when the requested route has no production HTML", () =>
  fixture((root) => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
  }));

test(
  "the built initial route omits deferred validation, dialogs, gestures and toasts",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const path = join(
        ".next",
        decodeURIComponent(src.replace(/^\/_next\//, "")),
      );
      assert.equal(
        readFileSync(path, "utf8").includes("ZodError"),
        false,
        `${src} contains server content validation`,
      );
      assert.equal(
        readFileSync(path, "utf8").includes("DialogContent"),
        false,
        `${src} eagerly loads the case-study dialog`,
      );
      assert.equal(
        readFileSync(path, "utf8").includes("dragSnapToOrigin"),
        false,
        `${src} eagerly loads gesture features`,
      );
      assert.equal(
        readFileSync(path, "utf8").includes("data-sonner-toaster"),
        false,
        `${src} eagerly loads toast rendering`,
      );
    }
  },
);

test(
  "English initial CSS excludes noncritical Japanese font faces",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const html = readFileSync(".next/server/app/en.html", "utf8");
    const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(
      (match) => match[1],
    );
    for (const tag of html.matchAll(/<link\b[^>]*>/g)) {
      if (!tag[0].includes('rel="stylesheet"')) continue;
      const href = tag[0].match(/href="([^"]+)"/)?.[1];
      if (!href?.startsWith("/_next/static/")) continue;
      styles.push(
        readFileSync(
          join(".next", decodeURIComponent(href.replace(/^\/_next\//, ""))),
          "utf8",
        ),
      );
    }
    assert.ok(
      styles.length,
      "must inspect initial styles, including inlineCss output",
    );
    for (const css of styles) {
      assert.equal(css.includes("font-family:Noto Sans JP;"), false);
      assert.equal(css.includes("font-family:Shippori Mincho;"), false);
    }
  },
);

test("the default budget run also measures the project archive page", () =>
  fixture((root) => {
    mkdirSync(join(root, ".next/server/app/en"), { recursive: true });
    for (const route of ["en", "ja", "vi", "en/quick"])
      writeFileSync(join(root, ".next/server/app", `${route}.html`), "");
    const missing = spawnSync(process.execPath, [script, "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(missing.status, 1, "a missing /en/projects build must fail");
    writeFileSync(join(root, ".next/server/app/en/projects.html"), "");
    const result = spawnSync(process.execPath, [script, "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      JSON.parse(result.stdout).map(({ route }) => route),
      ["/en", "/ja", "/vi", "/en/quick", "/en/projects"],
    );
  }));

test(
  "the home page does not load the project archive's table code",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const path = join(
        ".next",
        decodeURIComponent(src.replace(/^\/_next\//, "")),
      );
      assert.equal(
        readFileSync(path, "utf8").includes("data-archive-rows"),
        false,
        `${src} ships the archive table`,
      );
    }
  },
);

test(
  "Speed Insights loads after startup, outside the home page's initial scripts",
  { skip: !existsSync(".next/server/app/en.html") },
  () => {
    const result = spawnSync(process.execPath, [script, "en", "--json"], {
      encoding: "utf8",
    });
    const [{ chunks }] = JSON.parse(result.stdout);
    for (const { src } of chunks) {
      const path = join(
        ".next",
        decodeURIComponent(src.replace(/^\/_next\//, "")),
      );
      assert.equal(
        readFileSync(path, "utf8").includes("@vercel/speed-insights"),
        false,
        `${src} ships Speed Insights at startup`,
      );
    }
  },
);
