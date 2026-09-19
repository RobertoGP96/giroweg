import { cn } from "@/lib/cn";

interface ProgressBarProps {
  /** 0..1 */
  value: number;
  /** Amber when above 90 % or when flagged. */
  urgent?: boolean;
  label: string;
  className?: string;
}

/** 6 px track. Lime by default, amber for urgency. */
export function ProgressBar({ value, urgent = false, label, className }: ProgressBarProps) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("relative h-1.5 overflow-hidden rounded-full bg-track", className)}
    >
      <div
        className={cn("absolute inset-y-0 left-0 rounded-full", urgent ? "bg-amber" : "bg-lime")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface RingProps {
  /** 0..1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  paused?: boolean;
  label: string;
  children?: React.ReactNode;
  className?: string;
}

/** Circular progress ring with content in the middle (trip progress). */
export function Ring({
  value,
  size = 196,
  strokeWidth = 10,
  paused = false,
  label,
  children,
  className,
}: RingProps) {
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(value, 0), 1);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-surface stroke-track"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn("transition-[stroke-dashoffset,stroke] duration-700", paused ? "stroke-amber" : "stroke-lime")}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}
