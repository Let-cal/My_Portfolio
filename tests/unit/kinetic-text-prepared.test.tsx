import { cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { KineticText } from "@/components/fx/KineticText";
import { segmentKineticWords } from "@/components/fx/kinetic-words";
import { Children, isValidElement, type ReactNode } from "react";
import { Hero } from "@/components/sections/Hero";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { ContactHeadline } from "@/components/sections/contact/ContactHeadline";
import { Contact } from "@/components/sections/Contact";

const motion = vi.hoisted(() => ({ reduced: false }));
const reveal = vi.hoisted(() => ({ armed: false, shown: false }));
vi.mock("@/components/fx/use-media-query", () => ({
  usePrefersReducedMotion: () => motion.reduced,
}));
vi.mock("@/components/fx/use-reveal-on-view", () => ({
  useRevealOnView: () => ({ ref: undefined, ...reveal }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => (key === "headline" ? "Lâm 👩‍💻" : key),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  motion.reduced = false;
  reveal.armed = false;
  reveal.shown = false;
});

it("Contact prepares its headline on the server and the client skips segmentation even when reveal remounts letters", () => {
  const section = Contact({ content: contentSchema.parse(seed), locale: "en" });
  const headline = Children.toArray(section.props.children).find(
    (child) => isValidElement(child) && child.type === ContactHeadline,
  );
  expect(isValidElement(headline)).toBe(true);
  const props = (
    headline as React.ReactElement<React.ComponentProps<typeof ContactHeadline>>
  ).props;
  expect(props.preparedWords).toEqual([["L", "â", "m"], ["👩‍💻"]]);
  const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
  const { container, rerender } = render(<ContactHeadline {...props} />);
  reveal.armed = true;
  rerender(<ContactHeadline {...props} />);
  expect(container.querySelector("h2")).toHaveAttribute("data-held");
  expect(container.querySelectorAll("[data-char]")).toHaveLength(5);
  expect(segment).not.toHaveBeenCalled();
});

it("prepares graphemes, emoji and exact space boundaries with the shared helper", () => {
  expect(segmentKineticWords("Lâm 👩‍💻")).toEqual([["L", "â", "m"], ["👩‍💻"]]);
  expect(segmentKineticWords(" 日本語  ")).toEqual([
    [],
    ["日", "本", "語"],
    [],
    [],
  ]);
  expect(segmentKineticWords("")).toEqual([[]]);
});

it("retains the code-point fallback when Segmenter is unavailable", () => {
  vi.stubGlobal("Intl", { Segmenter: undefined });
  expect(segmentKineticWords("A😀 B")).toEqual([["A", "😀"], ["B"]]);
});

it("Hero supplies serialized segmentation so its client name needs no Intl work", () => {
  const content = contentSchema.parse(seed);
  content.profile.name = "Lâm 👩‍💻";
  function find(node: ReactNode): Record<string, unknown> | undefined {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<{ children?: ReactNode }>(child)) continue;
      if (child.type === KineticText) return child.props;
      const found = find(child.props.children);
      if (found) return found;
    }
  }
  const props = find(Hero({ content, locale: "en" }));
  expect(props?.text).toBe("Lâm 👩‍💻");
  expect(props?.preparedWords).toEqual([["L", "â", "m"], ["👩‍💻"]]);
});

it("uses server-prepared Unicode words without client segmentation on render or rerender", () => {
  const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
  const text = "Lâm 👩‍💻";
  const preparedWords = [["L", "â", "m"], ["👩‍💻"]];
  const { container, rerender } = render(
    <KineticText text={text} preparedWords={preparedWords} staggerMs={30} />,
  );
  expect(
    [...container.querySelectorAll("[data-char]")].map((n) => n.textContent),
  ).toEqual(["L", "â", "m", " ", "👩‍💻"]);
  rerender(
    <KineticText text={text} preparedWords={preparedWords} staggerMs={40} />,
  );
  expect(segment).not.toHaveBeenCalled();
  expect(
    container.querySelectorAll<HTMLElement>("[data-char]")[4].style
      .animationDelay,
  ).toBe("160ms");
});

it.each([false, true])(
  "retains exact server markup with prepared words (reduced motion: %s)",
  (reduced) => {
    motion.reduced = reduced;
    for (const [text, words] of [
      ["Lâm 👩‍💻", [["L", "â", "m"], ["👩‍💻"]]],
      ["日本語", [["日", "本", "語"]]],
      [" A  B ", [[], ["A"], [], ["B"], []]],
      ["", [[]]],
    ] as const) {
      const plain = renderToString(
        <KineticText as="h2" text={text} staggerMs={30} className="example" />,
      );
      expect(
        renderToString(
          <KineticText
            as="h2"
            text={text}
            preparedWords={words}
            staggerMs={30}
            className="example"
          />,
        ),
      ).toBe(plain);
    }
  },
);
