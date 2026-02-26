"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { Role } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export type Tab = "home" | "attendance" | "shifts" | "my" | "new" | "review" | "proxy" | "users" | "admin";
type TopNavId = "home" | "attendance" | "shift" | "users" | "settings";

interface AppNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const ROLE_LABELS: Record<Role, string> = {
  staff: "アルバイト",
  reviewer: "レビュアー",
  admin: "管理者",
};

function getTopNavItems(role: Role): TopNavId[] {
  if (role === "staff") return ["home", "attendance", "shift"];
  if (role === "reviewer") return ["home", "attendance", "shift", "users"];
  return ["home", "attendance", "shift", "users", "settings"];
}

function getDefaultShiftTab(): Tab {
  return "shifts";
}

function getShiftSubmenu(role: Role): { id: Tab; label: string }[] {
  if (role === "staff") {
    return [
      { id: "shifts", label: "今後のシフト予定" },
      { id: "my", label: "申請一覧" },
      { id: "new", label: "新規申請" },
    ];
  }
  return [
    { id: "shifts", label: "今後のシフト予定" },
    { id: "review", label: "承認待ち" },
    { id: "proxy", label: "代理申請" },
  ];
}

function topLabel(id: TopNavId): string {
  if (id === "home") return "ホーム";
  if (id === "attendance") return "勤怠";
  if (id === "shift") return "シフト";
  if (id === "users") return "アルバイト";
  return "設定";
}

function toTopNav(tab: Tab): TopNavId {
  if (tab === "home") return "home";
  if (tab === "attendance") return "attendance";
  if (tab === "users") return "users";
  if (tab === "admin") return "settings";
  return "shift";
}

export function AppNav({ activeTab, onTabChange }: AppNavProps) {
  const { currentUser, logout, pendingCount } = useAppStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      logout: s.logout,
      pendingCount: s.requests.filter((r) => r.status === "pending").length,
    }))
  );
  const [open, setOpen] = useState(false);
  const [shiftMenuOpen, setShiftMenuOpen] = useState(false);
  const activeTopNav = toTopNav(activeTab);
  const isShiftActive = activeTopNav === "shift";

  useEffect(() => {
    if (isShiftActive) setShiftMenuOpen(true);
  }, [isShiftActive]);

  if (!currentUser) return null;
  const topNavItems = getTopNavItems(currentUser.role);
  const shiftTabs = getShiftSubmenu(currentUser.role);

  const handleTopNavClick = (id: TopNavId) => {
    if (id === "shift") {
      if (isShiftActive) {
        setShiftMenuOpen((v) => !v);
      } else {
        onTabChange(getDefaultShiftTab());
        setShiftMenuOpen(true);
      }
      return;
    }
    setShiftMenuOpen(false);
    if (id === "home") onTabChange("home");
    else if (id === "attendance") onTabChange("attendance");
    else if (id === "users") onTabChange("users");
    else onTabChange("admin");
  };

  return (
    <header className="surface-glass sticky top-0 z-40 w-full">
      <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--ds-layout-max-content-width)] items-center justify-between gap-4 px-[var(--ds-layout-page-gutter)]">

        {/* Logo */}
        <div className="shrink-0">
          <p className="text-[15px] font-medium tracking-[-0.01em] text-foreground select-none">シフト管理</p>
          <p className="text-[11px] leading-none text-[var(--on-surface-variant)] select-none mt-0.5">申請・承認</p>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-full bg-[var(--surface-container-low)] p-1" aria-label="メインナビゲーション">
          {topNavItems.map((item) => (
            <button
              key={item}
              onClick={() => handleTopNavClick(item)}
              className={cn(
                "tap-target relative rounded-full border border-transparent px-4 py-1.5 text-sm whitespace-nowrap transition-[background-color,color,box-shadow]",
                activeTopNav === item
                  ? "bg-[var(--secondary-container)] text-[var(--on-secondary-container)] font-medium shadow-[0_1px_2px_rgba(14,18,27,.1)]"
                  : "text-[var(--on-surface-variant)] hover:text-foreground hover:bg-[color-mix(in_oklab,var(--surface-container-high)_92%,white_8%)]"
              )}
            >
              {topLabel(item)}
              {item === "shift" && currentUser.role !== "staff" && pendingCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center shadow-[0_4px_12px_rgba(20,35,72,.35)]"
                  style={{
                    background: "color-mix(in oklab, var(--primary) 78%, black 22%)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className="tap-target flex h-12 w-12 items-center justify-center rounded-full bg-transparent p-0 text-sm text-[var(--on-surface-variant)] transition-[background-color,color] hover:bg-[var(--surface-container-low)] hover:text-foreground"
            aria-label="ユーザーメニュー"
          >
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold select-none border"
              style={{
                background: "var(--primary-container)",
                color: "var(--on-primary-container)",
                borderColor: "color-mix(in oklab, var(--primary) 28%, transparent)",
              }}
            >
              {currentUser.name.charAt(0)}
            </div>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-[var(--ds-component-modal-corner-radius)] border shadow-[var(--ds-elevation-overlay)] overflow-hidden motion-fade-in" style={{ background: "var(--surface-container-high)", borderColor: "var(--outline-variant)" }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: "var(--outline-variant)" }}>
                  <p className="text-sm font-semibold text-foreground leading-tight">{currentUser.name}</p>
                  <p className="text-[11px] text-[var(--on-surface-variant)] font-mono mt-0.5 truncate">{currentUser.email}</p>
                  <span className={cn(
                    "inline-block mt-1.5 text-[10px] font-semibold rounded-full px-2 py-0.5 tracking-wide border",
                    currentUser.role === "admin" ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                      : currentUser.role === "reviewer" ? "bg-[var(--secondary-container)] text-[var(--on-secondary-container)]"
                        : "bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)]"
                  )}>
                    {ROLE_LABELS[currentUser.role]}
                  </span>
                </div>
                <button
                  onClick={() => { logout(); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[var(--on-surface-variant)] hover:text-foreground hover:bg-[var(--surface-container)] transition-colors text-left"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  ログアウト
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {(isShiftActive || shiftMenuOpen) && (
        <div className="border-t border-[var(--outline-variant)]/80">
          <div className="mx-auto flex h-11 max-w-[var(--ds-layout-max-content-width)] items-center gap-1 overflow-x-auto no-scrollbar px-[var(--ds-layout-page-gutter)]">
            {shiftTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative rounded-full px-3.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  activeTab === tab.id
                    ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                    : "text-[var(--on-surface-variant)] hover:text-foreground hover:bg-[var(--surface-container-low)]"
                )}
              >
                {tab.label}
                {tab.id === "review" && pendingCount > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold text-[var(--status-pending)]">({pendingCount})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

export function AppNavSkeleton() {
  return (
    <header className="surface-glass sticky top-0 z-40 w-full">
      <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--ds-layout-max-content-width)] items-center justify-between gap-4 px-[var(--ds-layout-page-gutter)]">
        <div className="shrink-0">
          <p className="text-[15px] font-medium tracking-[-0.01em] text-foreground select-none">シフト管理</p>
          <p className="text-[11px] leading-none text-[var(--on-surface-variant)] select-none mt-0.5">読み込み中</p>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-full bg-[var(--surface-container-low)] p-1" aria-label="ナビゲーション読み込み">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </nav>
        <div className="shrink-0">
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </div>
    </header>
  );
}
