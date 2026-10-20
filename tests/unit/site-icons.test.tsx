import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as generated from "@/components/site/icons";
import * as originals from "lucide-react";

function normalize(markup: string) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = markup;
  const walk = (element: Element): unknown => [
    element.localName,
    [...element.attributes]
      .map((attribute) => [attribute.name, attribute.value])
      .sort(),
    [...element.children].map(walk),
  ];
  return walk(wrapper.firstElementChild!);
}

describe("generated inline icons", () => {
  it.each(Object.entries(generated))(
    "%s matches the original SVG with default and customized attributes",
    (name, Icon) => {
      const Original = originals[
        name as keyof typeof originals
      ] as ComponentType<Record<string, unknown>>;
      for (const props of [
        {},
        {
          className: "size-5 test",
          size: 32,
          color: "#0ea5e9",
          "aria-label": "test icon",
        },
      ]) {
        expect(
          normalize(renderToStaticMarkup(createElement(Icon, props))),
        ).toEqual(
          normalize(renderToStaticMarkup(createElement(Original, props))),
        );
      }
    },
  );
});
