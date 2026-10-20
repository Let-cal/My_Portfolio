import { useId } from "react";

/**
 * The card's gradient and its three layered waves, as on the old site (viewBox 0 0 300 400, stretched to the
 * card). The waves move with the pointer through CSS: `.why-card[data-hover]` reads `--why-tx / --why-ty`
 * (the pointer's offset from the card centre, -0.5..0.5) and shifts each layer by up to 20px in total.
 */
export function WaveBackground({ colors }: { colors: [string, string] }) {
  const uid = useId().replace(/:/g, "");
  const [from, to] = colors;
  return (
    <svg
      className="why-wave-svg h-full w-full"
      viewBox="0 0 300 400"
      preserveAspectRatio="none"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`why-bg-${uid}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <linearGradient id={`why-w1-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={from} />
          <stop offset="50%" stopColor={to} />
          <stop offset="100%" stopColor={from} />
        </linearGradient>
        <linearGradient id={`why-w2-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={to} />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#why-bg-${uid})`} />
      <path
        className="why-wave why-wave-1"
        d="M0,230 C30,220 60,240 90,230 C120,220 150,240 180,230 C210,220 240,240 270,230 C290,225 295,230 300,225 L300,400 L0,400 Z"
        fill={`url(#why-w1-${uid})`}
        opacity="0.8"
      />
      <path
        className="why-wave why-wave-2"
        d="M0,260 C40,250 80,270 120,260 C160,250 200,270 240,260 C280,250 290,260 300,255 L300,400 L0,400 Z"
        fill={`url(#why-w2-${uid})`}
        opacity="0.9"
      />
      <path
        className="why-wave why-wave-3"
        d="M0,290 C50,280 100,300 150,290 C200,280 250,300 300,290 L300,400 L0,400 Z"
        fill="#FFFFFF"
        opacity="0.9"
      />
    </svg>
  );
}
