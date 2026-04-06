import { Skeleton } from "@/components/ui/skeleton";

export default function SessionReviewLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="rounded-lg border divide-y">
        <div className="grid grid-cols-4 divide-x">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 divide-x">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="rounded-lg border p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-3/4" style={{ marginLeft: i % 2 === 0 ? 0 : "auto" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
