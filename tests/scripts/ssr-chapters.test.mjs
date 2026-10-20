import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

for (const locale of ["en", "ja", "vi"]) {
  const file = `.next/server/app/${locale}.html`;
  test(
    `${locale}: complete chapter content remains visible without stream reveal scripts`,
    { skip: !existsSync(file) },
    () => {
      // JSDOM does not execute Next's reveal scripts: hidden streamed content must fail this check.
      const dom = new JSDOM(readFileSync(file, "utf8"));
      try {
        for (const id of [
          "experience",
          "projects",
          "skills",
          "certificates",
          "why",
          "contact",
        ]) {
          const section = dom.window.document.getElementById(id);
          assert.ok(section, `${id} has server-rendered content`);
          assert.equal(
            section.closest("[hidden]"),
            null,
            `${id} must not need a stream reveal script`,
          );
          assert.ok(
            section.closest(".portfolio-chapter"),
            `${id} remains inside its chapter`,
          );
          assert.ok(
            section.querySelector(`#${id}-heading`)?.textContent.trim(),
            `${id} heading is readable`,
          );
        }
      } finally {
        dom.window.close();
      }
    },
  );
}
