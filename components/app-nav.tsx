"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { Role } from "@/lib/types";
import { CalendarDays, Clock3, Home, LogOut, Settings, Users } from "lucide-react";

export type Tab = "home" | "attendance" | "attendance-home" | "attendance-list" | "attendance-manage" | "shifts" | "my" | "new" | "review" | "proxy" | "users" | "admin";
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

function getDefaultAttendanceTab(role: Role): Tab {
  return role === "staff" ? "attendance-home" : "attendance-list";
}

function getAttendanceSubmenu(role: Role): { id: Tab; label: string }[] {
  if (role === "staff") {
    return [
      { id: "attendance-home", label: "勤怠ホーム" },
      { id: "attendance-list", label: "勤怠一覧" },
    ];
  }
  return [
    { id: "attendance-list", label: "勤怠一覧" },
    { id: "attendance-manage", label: "管理" },
  ];
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
  if (tab === "attendance" || tab === "attendance-home" || tab === "attendance-list" || tab === "attendance-manage") return "attendance";
  if (tab === "users") return "users";
  if (tab === "admin") return "settings";
  return "shift";
}

function topIcon(id: TopNavId) {
  if (id === "home") return Home;
  if (id === "attendance") return Clock3;
  if (id === "shift") return CalendarDays;
  if (id === "users") return Users;
  return Settings;
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
  const [attendanceMenuOpen, setAttendanceMenuOpen] = useState(false);
  const activeTopNav = toTopNav(activeTab);
  const isShiftActive = activeTopNav === "shift";
  const isAttendanceActive = activeTopNav === "attendance";

  useEffect(() => {
    // 排他的にサブメニューを開く（二重表示防止）
    if (isShiftActive) {
      setAttendanceMenuOpen(false);
      setShiftMenuOpen(true);
    } else if (isAttendanceActive) {
      setShiftMenuOpen(false);
      setAttendanceMenuOpen(true);
    } else {
      setShiftMenuOpen(false);
      setAttendanceMenuOpen(false);
    }
  }, [isShiftActive, isAttendanceActive]);

  if (!currentUser) return null;
  const topNavItems = getTopNavItems(currentUser.role);
  const activeIndex = Math.max(0, topNavItems.findIndex((item) => item === activeTopNav));
  const shiftTabs = getShiftSubmenu(currentUser.role);
  const attendanceTabs = getAttendanceSubmenu(currentUser.role);

  const handleTopNavClick = (id: TopNavId) => {
    // 最初に両方のサブメニューを閉じてから、必要なものだけ開く
    // これにより二重表示を防ぐ
    if (id === "shift") {
      setAttendanceMenuOpen(false);
      if (isShiftActive) {
        setShiftMenuOpen((v) => !v);
      } else {
        setShiftMenuOpen(true);
        onTabChange(getDefaultShiftTab());
      }
      return;
    }
    if (id === "attendance") {
      setShiftMenuOpen(false);
      if (isAttendanceActive) {
        setAttendanceMenuOpen((v) => !v);
      } else {
        setAttendanceMenuOpen(true);
        onTabChange(getDefaultAttendanceTab(currentUser.role));
      }
      return;
    }
    setShiftMenuOpen(false);
    setAttendanceMenuOpen(false);
    if (id === "home") onTabChange("home");
    else if (id === "users") onTabChange("users");
    else onTabChange("admin");
  };

  return (
    <>
      <header className="surface-glass sticky top-0 z-40 w-full border-b border-[var(--outline-variant)]/50">
        <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--ds-layout-max-content-width)] items-center justify-between gap-4 px-[var(--ds-layout-page-gutter)]">
          <div className="shrink-0 flex items-center gap-2">
            <div className="h-8 w-8 rounded-[var(--ds-radius-sm)] bg-[var(--primary)] flex items-center justify-center">
              <span className="text-sm font-bold text-white">N</span>
            </div>
            <p className="text-base font-semibold tracking-[-0.02em] text-foreground select-none">notocord</p>
          </div>

          <nav className="hidden md:flex h-11 items-center gap-0.5 overflow-x-auto no-scrollbar" aria-label="メインナビゲーション">
            {topNavItems.map((item) => (
              <button
                key={item}
                onClick={() => handleTopNavClick(item)}
                className={cn(
                  "tap-target relative inline-flex h-10 items-center px-4 text-sm whitespace-nowrap transition-all rounded-[var(--ds-radius-md)]",
                  activeTopNav === item
                    ? "text-[var(--primary)] font-semibold bg-[var(--primary-container)]/50"
                    : "text-[var(--on-surface-variant)] hover:text-foreground hover:bg-[var(--surface-container)]"
                )}
              >
                {topLabel(item)}
                {item === "shift" && currentUser.role !== "staff" && pendingCount > 0 && (
                  <span
                    className="ml-1.5 h-5 min-w-5 px-1 rounded-[var(--ds-radius-pill)] text-[10px] font-bold flex items-center justify-center shadow-[0_2px_8px_rgba(20,35,72,.25)] badge-primary"
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="relative shrink-0">
            <button
              onClick={() => setOpen((v) => !v)}
              className="tap-target flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-pill)] bg-[var(--surface-container)] text-sm text-[var(--on-surface-variant)] transition-all hover:bg-[var(--surface-container-high)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
              aria-label="ユーザーメニュー"
            >
              <div
                className="h-8 w-8 rounded-[var(--ds-radius-pill)] flex items-center justify-center text-xs font-bold select-none avatar-primary"
              >
                {currentUser.name.charAt(0)}
              </div>
            </button>

            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-[var(--ds-radius-lg)] border border-[var(--outline-variant)] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden motion-fade-in bg-[var(--surface-container-lowest)]">
                  <div className="px-4 py-4 border-b border-[var(--outline-variant)]/50 bg-[var(--surface-container)]">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-[var(--ds-radius-pill)] flex items-center justify-center text-sm font-bold select-none avatar-primary">
                        {currentUser.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">{currentUser.name}</p>
                        <p className="text-[11px] text-[var(--on-surface-variant)] mt-0.5 truncate">{currentUser.email}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "inline-block mt-3 text-[10px] font-semibold rounded-[var(--ds-radius-pill)] px-2.5 py-1 tracking-wide",
                      currentUser.role === "admin" ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                        : currentUser.role === "reviewer" ? "bg-[var(--secondary-container)] text-[var(--on-secondary-container)]"
                          : "bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)]"
                    )}>
                      {ROLE_LABELS[currentUser.role]}
                    </span>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        logout();
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--on-surface-variant)] hover:text-[var(--status-rejected)] hover:bg-[var(--status-rejected-bg)] rounded-[var(--ds-radius-md)] transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      ログアウト
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {(isShiftActive || shiftMenuOpen) && (
          <div className="border-b border-[var(--outline-variant)]/50 bg-[var(--surface-container-lowest)]">
            <div className="mx-auto flex h-11 max-w-[var(--ds-layout-max-content-width)] items-center gap-1.5 overflow-x-auto no-scrollbar px-[var(--ds-layout-page-gutter)]">
              {shiftTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "inline-flex h-8 items-center px-4 text-xs font-semibold whitespace-nowrap transition-all rounded-[var(--ds-radius-pill)]",
                    activeTab === tab.id
                      ? "text-white bg-[var(--primary)] shadow-[0_2px_8px_rgba(50,93,168,0.25)]"
                      : "text-[var(--on-surface-variant)] hover:text-foreground hover:bg-[var(--surface-container)]"
                  )}
                >
                  {tab.label}
                  {tab.id === "review" && pendingCount > 0 && (
                    <span className={cn(
                      "ml-1.5 text-[10px] font-bold",
                      activeTab === tab.id ? "text-white/80" : "text-[var(--status-pending)]"
                    )}>({pendingCount})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {(isAttendanceActive || attendanceMenuOpen) && (
          <div className="border-b border-[var(--outline-variant)]/50 bg-[var(--surface-container-lowest)]">
            <div className="mx-auto flex h-11 max-w-[var(--ds-layout-max-content-width)] items-center gap-1.5 overflow-x-auto no-scrollbar px-[var(--ds-layout-page-gutter)]">
              {attendanceTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "inline-flex h-8 items-center px-4 text-xs font-semibold whitespace-nowrap transition-all rounded-[var(--ds-radius-pill)]",
                    activeTab === tab.id
                      ? "text-white bg-[var(--primary)] shadow-[0_2px_8px_rgba(50,93,168,0.25)]"
                      : "text-[var(--on-surface-variant)] hover:text-foreground hover:bg-[var(--surface-container)]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--outline-variant)]/90 bg-[color-mix(in_oklab,var(--surface-container-low)_92%,transparent)] backdrop-blur-md px-2 pt-2 pb-[max(env(safe-area-inset-bottom),8px)] md:hidden">
        <div
          className="relative mx-auto grid max-w-[var(--ds-layout-max-content-width)] rounded-[var(--ds-radius-lg)] p-1"
          style={{ gridTemplateColumns: `repeat(${topNavItems.length}, minmax(0, 1fr))` }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute left-1 top-1 bottom-1 rounded-[var(--ds-radius-md)] bg-[var(--primary-container)] shadow-[0_1px_2px_rgba(14,18,27,.12)] transition-transform duration-300 ease-out"
            style={{
              width: `calc((100% - 0.5rem) / ${topNavItems.length})`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
          {topNavItems.map((item) => {
            const Icon = topIcon(item);
            const isActive = activeTopNav === item;
            return (
              <button
                key={`mobile-${item}`}
                onClick={() => handleTopNavClick(item)}
                className={cn(
                  "relative z-10 flex h-[56px] flex-col items-center justify-center gap-0.5 rounded-[var(--ds-radius-md)] transition-colors",
                  isActive
                    ? "text-[var(--on-primary-container)]"
                    : "text-[var(--on-surface-variant)] hover:text-foreground"
                )}
                aria-label={topLabel(item)}
                title={topLabel(item)}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={2.4} />
                <span className="text-[10px] font-medium leading-none">{topLabel(item)}</span>
                {item === "shift" && currentUser.role !== "staff" && pendingCount > 0 && (
                  <span className="absolute right-[calc(50%-22px)] top-1 min-w-[18px] h-[18px] rounded-[var(--ds-radius-pill)] px-1 text-[10px] font-bold leading-[18px] text-center shadow-[0_4px_12px_rgba(20,35,72,.35)] badge-primary"
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
