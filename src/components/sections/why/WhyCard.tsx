import { formatTickerValue } from "@/lib/ticker-format";
import { ArrowRightIcon } from "@/components/site/icons";
import { NumberTicker } from "@/components/fx/NumberTicker";
import { WaveBackground } from "./WaveBackground";
import { WhyCardFrame } from "./WhyCardFrame";

/** A why-card with every string already picked for the current locale. */
export type WhyCardView = {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  body: string;
  colors: [string, string];
  /** `#exp-<id>` / `#proj-<id>`, or null for no evidence link. */
  evidenceLink: string | null;
  stat: { value: number; prefix?: string; suffix?: string; label: string } | null;
};

/** Static artwork and text stay in the server tree; the frame owns the unchanged pointer interactions. */
export function WhyCard({ card, evidenceLabel }: { card: WhyCardView; evidenceLabel: string }) {
  const { stat } = card;
  return (
    <WhyCardFrame>
      <div className="why-layer why-layer-0 absolute inset-0 overflow-hidden rounded-md shadow-[0_14px_30px_-16px_rgb(0_0_0/0.55)]">
        <WaveBackground colors={card.colors} />
      </div>

      <div aria-hidden="true" className="why-layer why-layer-1 pointer-events-none absolute inset-0 z-30">
        <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="h-full w-full" focusable="false">
          <path
            className="why-frame"
            d="M 20,20 H 280 V 380 H 20 Z"
            pathLength={1}
            fill="none"
            stroke="rgba(0,0,0,0.8)"
            strokeWidth={1}
           
          />
        </svg>
      </div>

      <div className="why-layer why-layer-2 absolute inset-0 z-20 flex flex-col p-8 pb-9">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="why-meta-line h-px w-10 bg-black" />
          <span className="why-meta-text font-mono text-xs font-medium tracking-wider uppercase">{card.tag}</span>
        </div>

        {stat && (
          <div className="mt-5">
            <NumberTicker
              value={stat.value}
              formattedValue={formatTickerValue(stat.value, stat.prefix, stat.suffix)}
              prefix={stat.prefix}
              suffix={stat.suffix}
              className="font-heading text-6xl leading-none font-extrabold tracking-tight"
            />
            <p data-stat-label="" className="mt-2 max-w-[85%] text-xs leading-snug font-medium [word-break:auto-phrase]">
              {stat.label}
            </p>
          </div>
        )}

        <div className="mt-auto">
          <h3 className="why-title font-heading text-[22px] leading-[1.15] font-extrabold tracking-tight [word-break:auto-phrase]">{card.title}</h3>
          <p className="why-subtitle mt-2 text-xs font-medium tracking-wider uppercase">{card.subtitle}</p>
          <p className="mt-4 text-[13px] leading-[1.55] [word-break:auto-phrase]">{card.body}</p>
          {card.evidenceLink && (
            <a
              href={card.evidenceLink}
              draggable={false}
              className="mt-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold underline decoration-black/40 underline-offset-4 outline-offset-4 hover:decoration-black focus-visible:outline-2 focus-visible:outline-black"
            >
              {evidenceLabel}
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </a>
          )}
        </div>
      </div>
    </WhyCardFrame>
  );
}
