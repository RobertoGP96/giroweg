import { cn } from "@/lib/cn";

interface RouteMapProps {
  /** 0..1 share of the route already travelled. Defaults to complete. */
  progress?: number;
  /** Compact variant for the trip detail header. */
  variant?: "live" | "detail";
  className?: string;
}

const LIVE_PATH = "M60 470 L60 380 Q60 350 90 350 L200 350 L200 250 Q200 220 230 220 L320 220 L320 120";
const LIVE_LENGTH = 620;
const DETAIL_PATH = "M50 290 L50 220 Q50 200 70 200 L160 200 L160 130 Q160 110 180 110 L300 110 L300 60 L340 60";

/**
 * Placeholder map: a grid with the route drawn as an SVG path. A real map
 * (tiles) replaces this once the GPS pipeline is wired; keep the same props.
 */
export function RouteMap({ progress = 1, variant = "live", className }: RouteMapProps) {
  const pct = Math.min(Math.max(progress, 0), 1);
  if (variant === "detail") {
    return (
      <div className={cn("bg-map-grid relative overflow-hidden", className)} aria-hidden>
        <svg viewBox="0 0 390 340" className="absolute inset-0 h-full w-full" fill="none" preserveAspectRatio="xMidYMid slice">
          <path d={DETAIL_PATH} className="stroke-lime" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={50} cy={290} r={7} className="fill-bg stroke-lime" strokeWidth={3} />
          <circle cx={160} cy={200} r={8} className="fill-lime" />
          <circle cx={180} cy={110} r={8} className="fill-lime" />
          <circle cx={300} cy={80} r={8} className="fill-lime" />
          <circle cx={340} cy={60} r={8} className="fill-lime stroke-bg" strokeWidth={3} />
        </svg>
      </div>
    );
  }
  return (
    <div className={cn("bg-map-grid absolute inset-0", className)} aria-hidden>
      <svg viewBox="0 0 390 520" className="absolute top-0 left-1/2 h-130 w-97.5 -translate-x-1/2" fill="none">
        <path d={LIVE_PATH} className="stroke-track" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={LIVE_PATH}
          className="stroke-lime transition-[stroke-dashoffset] duration-1000 ease-linear"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={LIVE_LENGTH}
          strokeDashoffset={LIVE_LENGTH * (1 - pct)}
        />
        <circle cx={60} cy={470} r={7} className="fill-bg stroke-lime" strokeWidth={3} />
        <circle cx={200} cy={350} r={9} className={pct > 0.35 ? "fill-lime" : "fill-surface-2 stroke-muted"} strokeWidth={2} />
        <circle cx={320} cy={220} r={9} className={pct > 0.8 ? "fill-lime" : "fill-surface-2 stroke-muted"} strokeWidth={2} />
        <circle cx={320} cy={120} r={9} className="fill-surface-2 stroke-muted" strokeWidth={2} />
      </svg>
    </div>
  );
}
