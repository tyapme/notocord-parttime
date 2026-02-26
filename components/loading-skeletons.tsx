"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { AppNavSkeleton } from "@/components/app-nav";

export function AuthLoadingSkeleton({
  title = "画面を読み込み中",
  subtitle = "データを準備しています",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen">
      <AppNavSkeleton />
      <main className="app-content">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
        <div className="mt-6 space-y-2">
          <ListCardSkeleton rows={4} />
        </div>
      </main>
    </div>
  );
}

export function ListCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="surface-card-subtle px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-14 rounded-md" />
                <Skeleton className="h-4 w-28 rounded-md" />
              </div>
              <Skeleton className="h-3 w-52 rounded-md" />
            </div>
            <Skeleton className="h-6 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </>
  );
}
