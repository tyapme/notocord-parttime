"use client";

import { Status } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { useIsMobile } from "@/components/ui/use-mobile";
import { XIcon } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import * as DialogPrimitive from "@radix-ui/react-dialog";

/**
 * 共通モーダル/ドロワー フレームコンポーネント
 * - モバイル: Vaul Drawerを使用（下スワイプで閉じれる）
 * - デスクトップ: Radix Dialogを使用（中央モーダル）
 */
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
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[92dvh] rounded-t-[22px] border border-b-0 border-[var(--outline-variant)] bg-[var(--surface-container-high)] shadow-[var(--ds-elevation-overlay)]">
          {/* ドラッグハンドル */}
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-[var(--outline-variant)]" />

          <DrawerHeader className="px-5 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <DrawerTitle asChild>
                <div className="flex items-center gap-2 min-w-0">{header}</div>
              </DrawerTitle>
              {status && <StatusBadge status={status} />}
            </div>
            {/* Radix requires description for accessibility */}
            <DrawerDescription className="sr-only">モーダルコンテンツ</DrawerDescription>
          </DrawerHeader>

          <div
            className={cn(
              "overflow-y-auto no-scrollbar min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0px)]",
              bodyClassName
            )}
          >
            {children}
          </div>

          {footer && (
            <DrawerFooter className="px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-0 modal-divider">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  // デスクトップ: Radix Dialog
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/15 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full overflow-hidden max-h-[92dvh] min-h-0 flex flex-col modal-surface",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            maxWidthClassName ?? "max-w-sm"
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <DialogPrimitive.Title asChild>
              <div className="flex items-center gap-2 min-w-0">{header}</div>
            </DialogPrimitive.Title>
            <div className="flex items-center gap-2.5 shrink-0">
              {status && <StatusBadge status={status} />}
              <DialogPrimitive.Close asChild>
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="閉じる"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </DialogPrimitive.Close>
            </div>
          </div>
          {/* Radix requires description for accessibility */}
          <DialogPrimitive.Description className="sr-only">モーダルコンテンツ</DialogPrimitive.Description>

          <div
            className={cn(
              "overflow-y-auto no-scrollbar min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0px)]",
              bodyClassName
            )}
          >
            {children}
          </div>

          {footer && (
            <div className="px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] modal-divider shrink-0">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
