import { cn } from "@/lib/cn";

interface LogoProps {
  /** Pixel size of the mark. Stroke is 3 at 24 px and above, 2 below. */
  size?: number;
  className?: string;
  /** Accessible name; omit when decorative next to the wordmark. */
  label?: string;
}

/** The "G": a circular arrow (the turn) opening into a straight road. */
export function LogoMark({ size = 36, className, label }: LogoProps) {
  const stroke = size >= 24 ? 3 : 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-lime-text", className)}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d="M29.5 10.5A13 13 0 1 0 33 20" />
      <path d="M20 20h20" />
      <path d="M35 15l5 5-5 5" />
    </svg>
  );
}

export function LogoHorizontal({ size = 32, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="font-display text-stat font-bold tracking-tight">GiroWeg</span>
    </div>
  );
}
