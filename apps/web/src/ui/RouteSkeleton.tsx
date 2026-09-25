import { Skeleton } from "@heroui/react";

type Variant = "tab" | "flow" | "auth";

/**
 * Instant placeholder while a route's code and data load (loading.tsx).
 * Mirrors each group's rhythm: tab roots (large title, big card, rows),
 * flow screens (back button, title, card, rows) and auth screens (logo,
 * title, paragraph, field). Server-safe.
 */
export function RouteSkeleton({ variant = "tab" }: { variant?: Variant }) {
  if (variant === "auth") {
    return (
      <div className="flex flex-1 flex-col gap-6 px-6 pt-8" aria-busy>
        <Skeleton className="h-7 w-28 rounded-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-56 rounded-full" />
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-3/4 rounded-full" />
        </div>
        <Skeleton className="h-15 rounded-lg" />
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-3.5 px-screen pt-2" aria-busy>
      <div className="flex min-h-14 items-center gap-3">
        {variant === "flow" && <Skeleton className="size-10 rounded-md" />}
        <Skeleton className={variant === "flow" ? "h-6 w-40 rounded-full" : "h-8 w-44 rounded-full"} />
      </div>
      <Skeleton className="h-45 rounded-lg" />
      <Skeleton className="h-17 rounded-lg" />
      <Skeleton className="h-17 rounded-lg" />
    </div>
  );
}
