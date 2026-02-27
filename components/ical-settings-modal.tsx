"use client";

import { useState, useCallback } from "react";
import { Copy, Check, Calendar, Lock, ExternalLink, RefreshCw, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Role } from "@/lib/types";
import { useIsMobile } from "@/components/ui/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import * as DialogPrimitive from "@radix-ui/react-dialog";

interface ICalSettingsModalProps {
  open: boolean;
  onClose: () => void;
  userRole: Role;
  userId: string;
}

interface ICalLink {
  id: string;
  label: string;
  description: string;
  url: string;
}

// モック用のシークレットトークン生成
function generateMockToken(userId: string, type: string): string {
  return `${userId.slice(0, 8)}-${type}-${Math.random().toString(36).substring(2, 10)}`;
}

// モック用のiCalリンク生成
function generateMockICalLinks(userId: string, role: Role): ICalLink[] {
  const baseUrl = "webcal://example.com/ical";

  const links: ICalLink[] = [];

  // 全ユーザー共通: 確定済み・未確定
  links.push({
    id: "approved",
    label: "確定済み",
    description: "承認されたシフトのみ",
    url: `${baseUrl}/${generateMockToken(userId, "approved")}/approved.ics`,
  });
  links.push({
    id: "pending",
    label: "未確定",
    description: "承認待ちのシフトのみ",
    url: `${baseUrl}/${generateMockToken(userId, "pending")}/pending.ics`,
  });

  // 管理者・レビュアー向け追加リンク
  if (role === "admin" || role === "reviewer") {
    links.push({
      id: "fix-approved",
      label: "Fix 確定済み",
      description: "Fix勤務の承認済みシフト",
      url: `${baseUrl}/${generateMockToken(userId, "fix-approved")}/fix-approved.ics`,
    });
    links.push({
      id: "fix-pending",
      label: "Fix 未確定",
      description: "Fix勤務の承認待ちシフト",
      url: `${baseUrl}/${generateMockToken(userId, "fix-pending")}/fix-pending.ics`,
    });
    links.push({
      id: "flex-approved",
      label: "Flex 確定済み",
      description: "Flex勤務の承認済みシフト",
      url: `${baseUrl}/${generateMockToken(userId, "flex-approved")}/flex-approved.ics`,
    });
    links.push({
      id: "flex-pending",
      label: "Flex 未確定",
      description: "Flex勤務の承認待ちシフト",
      url: `${baseUrl}/${generateMockToken(userId, "flex-pending")}/flex-pending.ics`,
    });
  }

  return links;
}

export function ICalSettingsModal({ open, onClose, userRole, userId }: ICalSettingsModalProps) {
  const isMobile = useIsMobile();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [links, setLinks] = useState<ICalLink[]>(() => generateMockICalLinks(userId, userRole));

  const handleCopy = useCallback(async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  const handleRegenerate = useCallback((id: string) => {
    setLinks((prev) =>
      prev.map((link) =>
        link.id === id
          ? { ...link, url: `webcal://example.com/ical/${generateMockToken(userId, id)}/${id}.ics` }
          : link
      )
    );
  }, [userId]);

  const isAdmin = userRole === "admin" || userRole === "reviewer";

  const headerContent = (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--primary-container)]">
        <Calendar className="h-5 w-5 text-[var(--primary)]" />
      </div>
      <div>
        <span className="text-base font-bold text-foreground">iCal連携</span>
        <p className="text-xs text-[var(--on-surface-variant)]">カレンダーアプリに登録</p>
      </div>
    </div>
  );

  const content = (
    <div className="p-5">
          {/* 説明 */}
          <div className="mb-5 rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)]/50 bg-[var(--surface-container)]/50 p-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 shrink-0 text-[var(--on-surface-variant)] mt-0.5" />
              <div className="text-sm text-[var(--on-surface-variant)]">
                <p className="font-medium text-foreground mb-1">秘密のアドレスについて</p>
                <p className="text-xs leading-relaxed">
                  このURLは非公開です。他の人に共有しないでください。
                  URLを知っている人は誰でもあなたのシフト情報を閲覧できます。
                  URLが漏洩した場合は再生成してください。
                </p>
              </div>
            </div>
          </div>

          {/* リンク一覧 */}
          <div className="space-y-3">
            {/* 基本リンク（全ユーザー） */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                基本
              </h3>
              {links.filter((l) => l.id === "approved" || l.id === "pending").map((link) => (
                <ICalLinkCard
                  key={link.id}
                  link={link}
                  copied={copiedId === link.id}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
                />
              ))}
            </div>

            {/* 管理者・レビュアー向け */}
            {isAdmin && (
              <>
                <div className="space-y-2 pt-3">
                  <h3 className="text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                    Fix
                  </h3>
                  {links.filter((l) => l.id.startsWith("fix-")).map((link) => (
                    <ICalLinkCard
                      key={link.id}
                      link={link}
                      copied={copiedId === link.id}
                      onCopy={handleCopy}
                      onRegenerate={handleRegenerate}
                    />
                  ))}
                </div>

                <div className="space-y-2 pt-3">
                  <h3 className="text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                    Flex
                  </h3>
                  {links.filter((l) => l.id.startsWith("flex-")).map((link) => (
                    <ICalLinkCard
                      key={link.id}
                      link={link}
                      copied={copiedId === link.id}
                      onCopy={handleCopy}
                      onRegenerate={handleRegenerate}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 使い方 */}
          <div className="mt-6 rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)]/50 bg-[var(--surface-container)]/30 p-4">
            <p className="text-xs font-semibold text-foreground mb-2">使い方</p>
            <ol className="text-xs text-[var(--on-surface-variant)] space-y-1.5 list-decimal list-inside">
              <li>上のURLをコピー</li>
              <li>Google カレンダーや Apple カレンダーを開く</li>
              <li>「URLで追加」または「照会カレンダー」を選択</li>
              <li>コピーしたURLを貼り付けて登録</li>
            </ol>
          </div>
    </div>
  );

  // モバイル: Drawer
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="max-h-[92dvh] rounded-t-[22px] border border-b-0 border-[var(--outline-variant)] bg-[var(--surface-container-high)] shadow-[var(--ds-elevation-overlay)]">
          {/* ドラッグハンドル */}
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-[var(--ds-radius-pill)] bg-[var(--outline-variant)]" />

          <DrawerHeader className="px-5 py-4 border-b border-border">
            <DrawerTitle asChild>
              {headerContent}
            </DrawerTitle>
            <DrawerDescription className="sr-only">iCal連携設定</DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto no-scrollbar min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0px)]">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // デスクトップ: Dialog
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/15 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full overflow-hidden max-h-[92dvh] min-h-0 flex flex-col modal-surface max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <DialogPrimitive.Title asChild>
              {headerContent}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="閉じる"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">iCal連携設定</DialogPrimitive.Description>

          <div className="overflow-y-auto no-scrollbar min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0px)]">
            {content}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface ICalLinkCardProps {
  link: ICalLink;
  copied: boolean;
  onCopy: (id: string, url: string) => void;
  onRegenerate: (id: string) => void;
}

function ICalLinkCard({ link, copied, onCopy, onRegenerate }: ICalLinkCardProps) {
  const isApproved = link.id.includes("approved");

  return (
    <div
      className={cn(
        "rounded-[var(--ds-radius-md)] border-l-4 p-3 transition-all",
        isApproved
          ? "border-l-[var(--status-approved)] bg-[var(--status-approved-bg)]/30"
          : "border-l-[var(--status-pending)] bg-[var(--status-pending-bg)]/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-[var(--ds-radius-pill)] px-2 py-0.5 text-[10px] font-bold",
                isApproved
                  ? "bg-[var(--status-approved)] text-white"
                  : "bg-[var(--status-pending)] text-white"
              )}
            >
              {link.label}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--on-surface-variant)]">{link.description}</p>
          <div className="mt-2 flex items-center gap-1 rounded-[var(--ds-radius-sm)] bg-[var(--surface-container)] px-2 py-1.5">
            <code className="flex-1 truncate text-[10px] text-[var(--on-surface-variant)] font-mono">
              {link.url}
            </code>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onCopy(link.id, link.url)}
          className={cn(
            "flex items-center gap-1.5 rounded-[var(--ds-radius-pill)] px-3 py-1.5 text-xs font-bold transition-all",
            copied
              ? "bg-[var(--status-approved)] text-white"
              : "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"
          )}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              コピー済み
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              コピー
            </>
          )}
        </button>
        <a
          href={link.url.replace("webcal://", "https://")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-[var(--ds-radius-pill)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)] transition-all hover:bg-[var(--surface-container)]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          開く
        </a>
        <button
          onClick={() => onRegenerate(link.id)}
          className="flex items-center gap-1.5 rounded-[var(--ds-radius-pill)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)] transition-all hover:bg-[var(--surface-container)]"
          title="URLを再生成"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          再生成
        </button>
      </div>
    </div>
  );
}
