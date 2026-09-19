import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface OdometerFrameProps {
  /** Six-digit dial text, e.g. "034218". */
  dial: string;
  /** Pill shown at the bottom (OCR confidence / failure). */
  badge?: ReactNode;
  /** Pill shown at the top-right corner. */
  corner?: ReactNode;
  /** Dashed amber frame and blurred digits when the OCR failed. */
  failed?: boolean;
  /** Tall 300 px capture frame (start) or compact 150 px (end). */
  compact?: boolean;
  className?: string;
}

/**
 * Camera viewfinder placeholder: dark surface with vignette, a lime target
 * frame with corner marks and the dial digits inside.
 */
export function OdometerFrame({ dial, badge, corner, failed = false, compact = false, className }: OdometerFrameProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-lg bg-surface-2",
        compact ? "h-37.5" : "h-75",
        className,
      )}
    >
      <div className="absolute inset-0 bg-vignette" aria-hidden />
      <div
        className={cn(
          "relative flex items-center justify-center rounded-md border-2 bg-ink/55",
          compact ? "h-20 w-55" : "h-27.5 w-62.5",
          failed ? "border-dashed border-amber" : "border-lime",
        )}
      >
        {!failed && !compact && (
          <>
            <Corner className="-top-px -left-px rounded-tl-md border-t-4 border-l-4" />
            <Corner className="-top-px -right-px rounded-tr-md border-t-4 border-r-4" />
            <Corner className="-bottom-px -left-px rounded-bl-md border-b-4 border-l-4" />
            <Corner className="-bottom-px -right-px rounded-br-md border-b-4 border-r-4" />
          </>
        )}
        <span
          className={cn(
            "font-display font-bold tracking-dial text-camera-text",
            compact ? "text-dial-sm" : "text-dial",
            failed && "blur-xs",
          )}
          aria-hidden={failed}
        >
          {dial}
        </span>
      </div>
      {badge && <div className="absolute inset-x-0 bottom-3.5 flex justify-center">{badge}</div>}
      {corner && <div className="absolute top-3 right-3">{corner}</div>}
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={cn("absolute size-5.5 border-lime", className)} aria-hidden />;
}
