import { motionValue, scroll, springValue } from "motion";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function attachBeam(element: HTMLElement) {
  const source = motionValue(0);
  const progress = springValue(source, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });
  const path = element.querySelector<SVGPathElement>("[data-beam-path]");
  const head = element.querySelector<HTMLElement>("[data-beam-head]");
  const write = (value: number) => {
    const amount = clamp(value);
    element.dataset.progress = amount.toFixed(3).replace(/\.?0+$/, "") || "0";
    path?.setAttribute("stroke-dashoffset", String(1 - amount));
    if (head) head.style.top = `${amount * 100}%`;
  };
  const unsubscribe = progress.on("change", write);
  const stop = scroll((value) => source.set(value), {
    target: element,
    offset: ["start 70%", "end 50%"],
  });
  write(progress.get());
  return () => {
    stop();
    unsubscribe();
    progress.destroy();
    source.destroy();
  };
}

export function attachWords(element: HTMLElement) {
  const units = [
    ...element.querySelectorAll<HTMLElement>("[data-reveal-unit]"),
  ];
  return scroll(
    (progress) => {
      units.forEach((word, index) => {
        const amount = clamp(progress * units.length - index);
        word.style.opacity = String(0.65 + 0.35 * amount);
      });
    },
    { target: element, offset: ["start 0.9", "end 0.5"] },
  );
}
