"use client";

import { useEffect, useState } from "react";
import { RequestHistoryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RequestHistoryTimeline } from "@/components/request-history-timeline";

type RequestHistoryToggleProps = {
  requestId: string;
  entries?: RequestHistoryEntry[];
  loading?: boolean;
  onLoad: (requestId: string) => Promise<void> | void;
  buttonClassName?: string;
};

export function RequestHistoryToggle({
  requestId,
  entries,
  loading = false,
  onLoad,
  buttonClassName,
}: RequestHistoryToggleProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [requestId]);

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (entries === undefined && !loading) {
      void onLoad(requestId);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "text-xs font-medium text-[var(--on-surface-variant)] hover:text-foreground hover:underline underline-offset-2 transition-colors",
          buttonClassName
        )}
      >
        {open ? "変更履歴を閉じる" : "変更履歴を見る"}
      </button>
      {open && <RequestHistoryTimeline entries={entries ?? []} loading={loading} />}
    </>
  );
}
