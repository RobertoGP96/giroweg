import { Skeleton } from "@heroui/react";

/**
 * Instant placeholder while a route's code and data load (loading.tsx).
 * Mirrors the screen rhythm: header, big card, rows. Server-safe.
 */
export function RouteSkeleton({ withTopBar = false }: { withTopBar?: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-3.5 px-screen pt-2" aria-busy>
      <div className="flex min-h-14 items-center gap-3">
        {withTopBar && <Skeleton className="size-10 rounded-md" />}
        <Skeleton className="h-6 w-40 rounded-full" />
      </div>
      <Skeleton className="h-45 rounded-lg" />
      <Skeleton className="h-17 rounded-lg" />
      <Skeleton className="h-17 rounded-lg" />
    </div>
  );
}
