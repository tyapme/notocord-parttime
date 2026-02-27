"use client";

import { Status } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { XIcon } from "lucide-react";

function FrameContent({
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
      className={cn(
        "mx-auto w-full overflow-hidden max-h-[92dvh] min-h-0 flex flex-col",
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

      <div className={cn("overflow-y-auto no-scrollbar min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0px)]", bodyClassName)}>
        {children}
      </div>

      {footer && <div className="px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] modal-divider shrink-0">{footer}</div>}
    </div>
  );
}

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
      className="fixed inset-0 z-50 bg-foreground/15 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full items-center justify-center overflow-y-auto px-4 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        <FrameContent
          onClose={onClose}
          header={header}
          status={status}
          footer={footer}
          maxWidthClassName={cn("modal-surface", maxWidthClassName ?? "max-w-sm")}
          bodyClassName={bodyClassName}
        >
          {children}
        </FrameContent>
      </div>
    </div>
  );
}
