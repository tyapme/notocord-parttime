"use client";

import { Status } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { XIcon } from "lucide-react";

export function ShiftRequestModalFrame({
  onClose,
  header,
  status,
  children,
  footer,
  maxWidthClassName,
  bodyClassName,
}: {
  onClose: () => void;
  header: React.ReactNode;
  status?: Status;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/15 backdrop-blur-sm px-4 pb-safe"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "modal-surface w-full overflow-hidden max-h-[92dvh] flex flex-col mb-4",
          maxWidthClassName ?? "max-w-sm"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">{header}</div>
          <div className="flex items-center gap-2.5 shrink-0">
            {status && <StatusBadge status={status} />}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="閉じる">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={cn("overflow-y-auto no-scrollbar flex-1", bodyClassName)}>{children}</div>

        {footer && <div className="px-5 pb-4 modal-divider shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
