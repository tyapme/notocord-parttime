"use client";

import { cn } from "@/lib/utils";
import { Status } from "@/lib/types";

const STATUS_MAP: Record<Status, { label: string; className: string }> = {
  pending: {
    label: "承認待ち",
    className: "bg-[var(--status-pending-bg)] text-[var(--status-pending)]",
  },
  approved: {
    label: "承認済み",
    className: "bg-[var(--status-approved-bg)] text-[var(--status-approved)]",
  },
  rejected: {
    label: "却下",
    className: "bg-[var(--status-rejected-bg)] text-[var(--status-rejected)]",
  },
  withdrawn: {
    label: "取り下げ",
    className: "bg-[var(--status-withdrawn-bg)] text-[var(--status-withdrawn)]",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const { label, className } = STATUS_MAP[status];
  return (
    <span className={cn("inline-flex items-center rounded-[var(--ds-radius-pill)] px-2.5 py-1 text-[11px] font-medium whitespace-nowrap border border-transparent", className)}>
      {label}
    </span>
  );
}
