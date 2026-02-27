"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { ICalSettingsModal } from "@/components/ical-settings-modal";
import {
  addDays,
  formatIsoWeekLabel,
  formatJstDateLabel,
  formatJstTime,
  formatYmd,
  getISOMonday,
  getJstDateValue,
} from "@/lib/datetime";
import { FixRequest, FlexRequest, Request, Status } from "@/lib/types";
import { ReviewRequestModal } from "@/app/review/review-request-modal";
import { StaffRequestModal } from "@/components/staff-request-modal";

type ShiftEvent = {
  key: string;
  requestId: string;
  dateYmd: string;
  type: "fix" | "flex";
  status: Status;
  userId: string;
  userName: string;
  shortLabel: string;
  detailLabel: string;
  sortIso: string;
};

type WeekFlexSummary = {
  key: string;
  requestId: string;
  userName: string;
  hours: number;
  status: Status;
};

type WeekFixSummary = {
  key: string;
  userId: string;
  userName: string;
  totalMinutes: number;
  totalHours: number;
};

type DayCell = {
  ymd: string;
  isToday: boolean;
  isPast: boolean;
  inCurrentMonth: boolean;
};

function PeriodStepButton({
  direction,
  onClick,
  label,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  label: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-[var(--ds-radius-pill)] border border-[var(--outline-variant)] bg-[var(--primary-container)] text-[var(--on-primary-container)] shadow-[0_1px_2px_rgba(20,35,72,.12)] transition-colors hover:bg-[color-mix(in_oklab,var(--primary-container)_90%,white_10%)]"
    >
      <Icon className="text-current" style={{ width: 20, height: 20 }} strokeWidth={2.6} />
    </button>
  );
}

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function shiftMonth(anchorYmd: string, delta: number): string {
  const d = new Date(`${anchorYmd}T00:00:00+09:00`);
  d.setMonth(d.getMonth() + delta);
  d.setDate(1);
  return formatYmd(d);
}

function monthLabel(anchorYmd: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
  }).format(new Date(`${anchorYmd}T00:00:00+09:00`));
}

function weekLabel(weekMonday: string): string {
  const end = addDays(weekMonday, 6);
  const fmt = (ymd: string) =>
    new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
    }).format(new Date(`${ymd}T00:00:00+09:00`));
  return `${fmt(weekMonday)}〜${fmt(end)}`;
}

function weekdayIndexMonBased(ymd: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(new Date(`${ymd}T00:00:00+09:00`));
  return WEEKDAY_INDEX[weekday] ?? 0;
}

function buildMonthCells(anchorYmd: string, todayYmd: string): DayCell[] {
  const monthPrefix = anchorYmd.slice(0, 7);
  const monthStartYmd = `${monthPrefix}-01`;
  const startOffset = weekdayIndexMonBased(monthStartYmd);
  const calendarStart = addDays(monthStartYmd, -startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const ymd = addDays(calendarStart, i);
    return {
      ymd,
      inCurrentMonth: ymd.slice(0, 7) === monthPrefix,
      isToday: ymd === todayYmd,
      isPast: ymd < todayYmd,
    };
  });
}

function buildWeekCells(weekMonday: string, todayYmd: string): DayCell[] {
  return Array.from({ length: 7 }, (_, i) => {
    const ymd = addDays(weekMonday, i);
    return {
      ymd,
      inCurrentMonth: true,
      isToday: ymd === todayYmd,
      isPast: ymd < todayYmd,
    };
  });
}

function asFixEvent(req: FixRequest, todayYmd: string, withUser: boolean): ShiftEvent | null {
  const start = req.status === "approved" && req.approvedStartAt ? req.approvedStartAt : req.requestedStartAt;
  const end = req.status === "approved" && req.approvedEndAt ? req.approvedEndAt : req.requestedEndAt;
  const dateYmd = getJstDateValue(start);
  if (dateYmd < todayYmd) return null;

  const timeRange = `${formatJstTime(start)}-${formatJstTime(end)}`;
  const name = req.userName ?? "不明";
  return {
    key: req.id,
    requestId: req.id,
    dateYmd,
    type: "fix",
    status: req.status,
    userId: req.userId,
    userName: name,
    shortLabel: withUser ? `${name} ${timeRange}` : timeRange,
    detailLabel: `${formatJstDateLabel(start)} ${timeRange}`,
    sortIso: start,
  };
}

function asFlexEvents(req: FlexRequest, todayYmd: string, withUser: boolean): ShiftEvent[] {
  const name = req.userName ?? "不明";
  const hours = req.status === "approved" && req.approvedHours != null ? req.approvedHours : req.requestedHours;
  const shortBase = withUser ? `${name} ${hours}時間` : `${hours}時間`;
  const weekRange = formatIsoWeekLabel(req.isoYear, req.isoWeek, req.weekStartDate);
  const events: ShiftEvent[] = [];

  for (let i = 0; i < 7; i += 1) {
    const dateYmd = addDays(req.weekStartDate, i);
    if (dateYmd < todayYmd) continue;
    events.push({
      key: `${req.id}-${dateYmd}`,
      requestId: req.id,
      dateYmd,
      type: "flex",
      status: req.status,
      userId: req.userId,
      userName: name,
      shortLabel: shortBase,
      detailLabel: `${weekRange} / ${hours}時間`,
      sortIso: `${dateYmd}T00:00:00+09:00`,
    });
  }

  return events;
}

function FutureShiftsScreen() {
  const currentUser = useAppStore((s) => s.currentUser);
  const requests = useAppStore((s) => s.requests);
  const fetchRequests = useAppStore((s) => s.fetchRequests);

  const todayYmd = formatYmd(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [weekAnchor, setWeekAnchor] = useState(getISOMonday(todayYmd));
  const [monthAnchor, setMonthAnchor] = useState(monthStart(todayYmd));
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [icalModalOpen, setIcalModalOpen] = useState(false);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const visibleRequests = useMemo(() => {
    const source = requests.filter((req) => req.status === "approved" || req.status === "pending");
    if (currentUser?.role === "staff") {
      return source.filter((req) => req.userId === currentUser.id);
    }
    return source;
  }, [requests, currentUser]);
  const requestById = useMemo(() => {
    const map = new Map<string, Request>();
    requests.forEach((req) => {
      map.set(req.id, req);
    });
    return map;
  }, [requests]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ShiftEvent[]>();
    const withUser = currentUser?.role !== "staff";

    visibleRequests.forEach((req: Request) => {
      if (req.type === "fix") {
        const event = asFixEvent(req as FixRequest, todayYmd, withUser);
        if (!event) return;
        const bucket = map.get(event.dateYmd) ?? [];
        bucket.push(event);
        map.set(event.dateYmd, bucket);
        return;
      }

      asFlexEvents(req as FlexRequest, todayYmd, withUser).forEach((event) => {
        const bucket = map.get(event.dateYmd) ?? [];
        bucket.push(event);
        map.set(event.dateYmd, bucket);
      });
    });

    map.forEach((events, dateKey) => {
      map.set(
        dateKey,
        [...events].sort((a, b) => {
          if (a.sortIso !== b.sortIso) return a.sortIso.localeCompare(b.sortIso);
          if (a.type !== b.type) return a.type === "fix" ? -1 : 1;
          return a.userName.localeCompare(b.userName, "ja");
        })
      );
    });

    return map;
  }, [visibleRequests, currentUser?.role, todayYmd]);

  const calendarDays = useMemo(
    () =>
      viewMode === "week"
        ? buildWeekCells(weekAnchor, todayYmd)
        : buildMonthCells(monthAnchor, todayYmd),
    [viewMode, weekAnchor, monthAnchor, todayYmd]
  );

  useEffect(() => {
    if (viewMode === "week") {
      const weekEnd = addDays(weekAnchor, 6);
      if (selectedDate < weekAnchor || selectedDate > weekEnd) {
        setSelectedDate(weekAnchor);
      }
      return;
    }

    const monthPrefix = monthAnchor.slice(0, 7);
    if (selectedDate.slice(0, 7) !== monthPrefix) {
      const firstCurrentMonth = calendarDays.find((d) => d.inCurrentMonth && !d.isPast)?.ymd
        ?? calendarDays.find((d) => d.inCurrentMonth)?.ymd
        ?? selectedDate;
      if (firstCurrentMonth !== selectedDate) {
        setSelectedDate(firstCurrentMonth);
      }
    }
  }, [viewMode, weekAnchor, monthAnchor, selectedDate, calendarDays]);

  const selectedFixItems = (eventsByDate.get(selectedDate) ?? []).filter((item) => item.type === "fix");
  const weekFlexSummaries = useMemo<WeekFlexSummary[]>(() => {
    if (viewMode !== "week") return [];
    const weekEnd = addDays(weekAnchor, 6);
    return visibleRequests
      .filter((req): req is FlexRequest => req.type === "flex")
      .filter((req) => req.weekStartDate <= weekEnd && addDays(req.weekStartDate, 6) >= weekAnchor)
      .map((req) => {
        const hours = req.status === "approved" && req.approvedHours != null ? req.approvedHours : req.requestedHours;
        return {
          key: req.id,
          requestId: req.id,
          userName: req.userName ?? "不明",
          hours,
          status: req.status,
        };
      })
      .sort((a, b) => {
        if (a.userName !== b.userName) return a.userName.localeCompare(b.userName, "ja");
        return a.hours - b.hours;
      });
  }, [viewMode, visibleRequests, weekAnchor]);

  const weekFixSummaries = useMemo<WeekFixSummary[]>(() => {
    if (viewMode !== "week") return [];
    const weekEnd = addDays(weekAnchor, 6);
    const minutesByUser = new Map<string, { userName: string; totalMinutes: number }>();

    visibleRequests
      .filter((req): req is FixRequest => req.type === "fix")
      .forEach((req) => {
        const startIso = req.status === "approved" && req.approvedStartAt ? req.approvedStartAt : req.requestedStartAt;
        const endIso = req.status === "approved" && req.approvedEndAt ? req.approvedEndAt : req.requestedEndAt;
        const dateYmd = getJstDateValue(startIso);
        if (dateYmd < todayYmd) return;
        if (dateYmd < weekAnchor || dateYmd > weekEnd) return;

        const durationMinutes = Math.max(
          0,
          Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
        );
        const cur = minutesByUser.get(req.userId) ?? {
          userName: req.userName ?? "不明",
          totalMinutes: 0,
        };
        cur.totalMinutes += durationMinutes;
        minutesByUser.set(req.userId, cur);
      });

    return Array.from(minutesByUser.entries())
      .map(([userId, summary]) => ({
        key: `fix-${userId}`,
        userId,
        userName: summary.userName,
        totalMinutes: summary.totalMinutes,
        totalHours: Math.floor(summary.totalMinutes / 60),
      }))
      .sort((a, b) => {
        if (a.totalHours !== b.totalHours) return b.totalHours - a.totalHours;
        return a.userName.localeCompare(b.userName, "ja");
      });
  }, [viewMode, visibleRequests, weekAnchor, todayYmd]);

  const periodLabel = viewMode === "week" ? weekLabel(weekAnchor) : monthLabel(monthAnchor);

  const movePrev = () => {
    if (viewMode === "week") {
      const nextMonday = addDays(weekAnchor, -7);
      setWeekAnchor(nextMonday);
      setSelectedDate(nextMonday);
      return;
    }
    setMonthAnchor((v) => shiftMonth(v, -1));
  };

  const moveNext = () => {
    if (viewMode === "week") {
      const nextMonday = addDays(weekAnchor, 7);
      setWeekAnchor(nextMonday);
      setSelectedDate(nextMonday);
      return;
    }
    setMonthAnchor((v) => shiftMonth(v, 1));
  };

  const moveToday = () => {
    setWeekAnchor(getISOMonday(todayYmd));
    setMonthAnchor(monthStart(todayYmd));
    setSelectedDate(todayYmd);
  };

  // スタッフの場合、自分のシフトタイプを判定
  const isStaff = currentUser?.role === "staff";
  const myShiftType = currentUser?.requestType;
  const isFlexUser = isStaff && myShiftType === "flex";
  const isFixUser = isStaff && myShiftType === "fix";

  if (!currentUser) return null;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">今後のシフト予定</h1>
          <p className="page-subtitle">
            {isStaff
              ? myShiftType === "flex"
                ? "週単位のFlex勤務予定を確認できます"
                : "今後の勤務予定を確認できます"
              : "Fix / Flex の今後予定を確認できます"
            }
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIcalModalOpen(true)}
          className="shrink-0 flex items-center gap-2 rounded-[var(--ds-radius-pill)] bg-[var(--surface-container)] px-3 py-2 text-xs font-semibold text-[var(--on-surface-variant)] transition-all hover:bg-[var(--surface-container-high)] hover:text-foreground"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">iCal連携</span>
        </button>
      </div>

      <div className="surface-card px-3 py-3 sm:px-5 sm:py-4">
        {/* モバイル: 縦積み / デスクトップ: 横並び */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* 期間切り替えトグル */}
          <div className="inline-flex self-start rounded-[var(--ds-radius-pill)] bg-[var(--surface-container)] p-1">
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "rounded-[var(--ds-radius-pill)] px-4 py-1.5 text-xs font-bold transition-all",
                viewMode === "week"
                  ? "bg-[var(--primary)] text-white shadow-[0_2px_6px_rgba(50,93,168,0.3)]"
                  : "text-[var(--on-surface-variant)] hover:text-foreground"
              )}
            >
              1週間
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "rounded-[var(--ds-radius-pill)] px-4 py-1.5 text-xs font-bold transition-all",
                viewMode === "month"
                  ? "bg-[var(--primary)] text-white shadow-[0_2px_6px_rgba(50,93,168,0.3)]"
                  : "text-[var(--on-surface-variant)] hover:text-foreground"
              )}
            >
              1ヶ月
            </button>
          </div>

          {/* 期間ナビゲーション */}
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <div className="flex items-center gap-1.5">
              <PeriodStepButton direction="prev" onClick={movePrev} label="前の期間" />
              <div className="min-w-[8rem] sm:min-w-[10rem] px-2 py-1.5 rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] text-center">
                <p className="text-sm font-bold text-foreground">{periodLabel}</p>
              </div>
              <PeriodStepButton direction="next" onClick={moveNext} label="次の期間" />
            </div>
            <button
              type="button"
              onClick={moveToday}
              className="rounded-[var(--ds-radius-pill)] bg-[var(--primary-container)] px-4 py-2 text-xs font-bold text-[var(--on-primary-container)] transition-all hover:bg-[var(--primary-container)]/80 active:scale-[0.98]"
            >
              今日
            </button>
          </div>
        </div>
      </div>

      {/* Flexユーザー専用: 週単位のサマリー表示 */}
      {isFlexUser && viewMode === "week" && (
        <div className="surface-card px-4 py-5 sm:px-6 sm:py-6">
          {weekFlexSummaries.length > 0 ? (
            <div className="space-y-4">
              {weekFlexSummaries.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    const req = requestById.get(item.requestId);
                    if (req) setSelectedRequest(req);
                  }}
                  className={cn(
                    "w-full rounded-[var(--ds-radius-lg)] border-l-4 p-5 sm:p-6 text-left transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] group",
                    item.status === "approved"
                      ? "border-l-[var(--status-approved)] bg-[var(--status-approved-bg)]/30"
                      : item.status === "pending"
                        ? "border-l-[var(--status-pending)] bg-[var(--status-pending-bg)]/30"
                        : "border-l-[var(--on-surface-variant)] bg-[var(--surface-container)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[var(--on-surface-variant)]">{periodLabel}</p>
                        <span
                          className={cn(
                            "rounded-[var(--ds-radius-pill)] px-2 py-0.5 text-[10px] font-bold",
                            item.status === "approved"
                              ? "bg-[var(--status-approved)] text-white"
                              : item.status === "pending"
                                ? "bg-[var(--status-pending)] text-white"
                                : "bg-[var(--on-surface-variant)] text-white"
                          )}
                        >
                          {item.status === "approved" ? "確定" : item.status === "pending" ? "承認待ち" : "却下"}
                        </span>
                      </div>
                      <p className="text-3xl sm:text-4xl font-bold text-foreground mt-1">
                        {item.hours}<span className="text-lg sm:text-xl font-semibold text-[var(--on-surface-variant)] ml-1">時間</span>
                      </p>
                    </div>
                    <ChevronRight className="h-6 w-6 text-[var(--on-surface-variant)] transition-colors group-hover:text-foreground" strokeWidth={2} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-14 w-14 rounded-[var(--ds-radius-pill)] bg-[var(--surface-container-high)] flex items-center justify-center mb-4">
                <CalendarDays className="h-7 w-7 text-[var(--on-surface-variant)]" />
              </div>
              <p className="text-base font-semibold text-foreground">この週の予定はありません</p>
              <p className="text-sm text-[var(--on-surface-variant)] mt-1">新しい申請を作成してください</p>
            </div>
          )}
        </div>
      )}

      {/* Fix / 管理者・レビュアー用: カレンダー表示 */}
      {!isFlexUser && (
      <div className="surface-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--outline-variant)]/50 bg-[var(--surface-container)]/50">
          {WEEKDAY_LABELS.map((w, i) => (
            <p
              key={w}
              className={cn(
                "py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold",
                i === 5 ? "text-[var(--primary)]" : i === 6 ? "text-[var(--status-rejected)]" : "text-[var(--on-surface-variant)]"
              )}
            >
              {w}
            </p>
          ))}
        </div>

        {/* 管理者・レビュアー向け週次Flexサマリー */}
        {!isStaff && viewMode === "week" && weekFlexSummaries.length > 0 && (
          <div className="border-b border-[var(--outline-variant)]/50 bg-[var(--tertiary-container)]/10 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-1.5 w-1.5 rounded-[var(--ds-radius-pill)] bg-[var(--tertiary)]" />
              <p className="text-[11px] sm:text-xs font-semibold text-[var(--on-surface-variant)]">週次Flex</p>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {weekFlexSummaries.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    const req = requestById.get(item.requestId);
                    if (req) setSelectedRequest(req);
                  }}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 py-1.5 sm:px-3 sm:py-2 text-left transition-all hover:bg-[var(--surface-container)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                >
                  <span className="text-[11px] sm:text-xs font-medium text-foreground">{item.userName}</span>
                  <span className="text-[11px] sm:text-xs font-bold text-[var(--tertiary)]">{item.hours}h</span>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={cn("grid gap-1 p-2 sm:gap-1.5 sm:p-3", viewMode === "week" ? "grid-cols-7" : "grid-cols-7")}>
          {calendarDays.map((day, idx) => {
            const allItems = eventsByDate.get(day.ymd) ?? [];
            // Fixユーザーの場合はFixイベントのみ、それ以外は全て表示
            const items = isFixUser ? allItems.filter((item) => item.type === "fix") : allItems;
            const fixItems = items.filter((item) => item.type === "fix");
            const isSelected = selectedDate === day.ymd;
            const dayOfWeek = idx % 7;
            const isSaturday = dayOfWeek === 5;
            const isSunday = dayOfWeek === 6;
            // 確定済みかどうか（1日1件なので最初のアイテムで判定）
            const hasApproved = items.some((item) => item.status === "approved");
            const hasPending = items.some((item) => item.status === "pending");
            const hasItem = items.length > 0;

            return (
              <button
                key={day.ymd}
                type="button"
                onClick={() => setSelectedDate(day.ymd)}
                className={cn(
                  "rounded-[var(--ds-radius-sm)] p-1.5 sm:p-2 text-left transition-all",
                  viewMode === "week" ? "min-h-[5rem] sm:min-h-[7rem]" : "min-h-[4rem] sm:min-h-[5.5rem]",
                  day.inCurrentMonth ? "bg-[var(--surface-container-lowest)]" : "bg-[var(--surface-container)]/50",
                  day.isPast ? "opacity-50" : "",
                  isSelected
                    ? "ring-2 ring-[var(--primary)] bg-[var(--primary-container)]/20 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                    : "hover:bg-[var(--surface-container)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.04)]"
                )}
              >
                <div className="flex items-center justify-between gap-0.5">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-[var(--ds-radius-pill)] text-[11px] sm:text-xs font-bold transition-all",
                      day.isToday
                        ? "bg-[var(--primary)] text-white shadow-[0_2px_6px_rgba(50,93,168,0.4)]"
                        : isSelected
                          ? "bg-[var(--primary-container)] text-[var(--primary)]"
                          : isSaturday
                            ? "text-[var(--primary)]"
                            : isSunday
                              ? "text-[var(--status-rejected)]"
                              : day.inCurrentMonth
                                ? "text-foreground"
                                : "text-[var(--on-surface-variant)]/50"
                    )}
                  >
                    {Number(day.ymd.slice(-2))}
                  </span>
                  {/* ステータスインジケーター：確定済み=緑、承認待ち=オレンジ */}
                  {hasItem && (
                    <span
                      className={cn(
                        "h-2 w-2 rounded-[var(--ds-radius-pill)]",
                        hasApproved
                          ? "bg-[var(--status-approved)]"
                          : hasPending
                            ? "bg-[var(--status-pending)]"
                            : "bg-[var(--on-surface-variant)]/30"
                      )}
                    />
                  )}
                </div>

                {/* イベント表示: モバイルでは非表示、デスクトップで表示 */}
                <div className="hidden sm:block mt-2 space-y-1">
                  {viewMode === "week" ? (
                    <>
                      {fixItems.slice(0, 2).map((item) => (
                        <div
                          key={item.key}
                          className={cn(
                            "truncate rounded-[var(--ds-radius-sm)] px-1.5 py-1 text-[10px] font-semibold",
                            item.status === "approved"
                              ? "bg-[var(--status-approved-bg)] text-[var(--status-approved)]"
                              : item.status === "pending"
                                ? "bg-[var(--status-pending-bg)] text-[var(--status-pending)]"
                                : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
                          )}
                        >
                          {item.shortLabel}
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {items.slice(0, 2).map((item) => (
                        <div
                          key={item.key}
                          className={cn(
                            "truncate rounded-[var(--ds-radius-sm)] px-1.5 py-0.5 text-[10px] font-semibold",
                            item.status === "approved"
                              ? "bg-[var(--status-approved-bg)] text-[var(--status-approved)]"
                              : item.status === "pending"
                                ? "bg-[var(--status-pending-bg)] text-[var(--status-pending)]"
                                : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
                          )}
                        >
                          {item.shortLabel}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {viewMode === "week" && weekFixSummaries.length > 0 && (
          <div className="border-t border-[var(--outline-variant)]/50 bg-[var(--primary-container)]/10 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-1.5 w-1.5 rounded-[var(--ds-radius-pill)] bg-[var(--primary)]" />
              <p className="text-[11px] sm:text-xs font-semibold text-[var(--on-surface-variant)]">
                {isFixUser ? "週の合計" : "1週間のFix合計"}
              </p>
            </div>
            {isFixUser ? (
              // Fixスタッフ向け: シンプルに合計時間だけ
              <p className="text-xl sm:text-2xl font-bold text-foreground">
                {weekFixSummaries[0]?.totalHours ?? 0}<span className="text-sm font-semibold text-[var(--on-surface-variant)] ml-1">時間</span>
              </p>
            ) : (
              // 管理者・レビュアー向け: ユーザーごとのリスト
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {weekFixSummaries.map((item) => (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 py-1.5 sm:px-3 sm:py-2"
                  >
                    <span className="text-[11px] sm:text-xs font-medium text-foreground">{item.userName}</span>
                    <span className="text-[11px] sm:text-xs font-bold text-[var(--primary)]">{item.totalHours}h</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* 日付詳細セクション - Fixユーザー、管理者、レビュアー用 */}
      {!isFlexUser && (
      <div className="surface-card px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">{formatJstDateLabel(`${selectedDate}T00:00:00+09:00`)}</h2>
          </div>
          {/* ステータスインジケーター */}
          {selectedFixItems.length > 0 && (
            <span
              className={cn(
                "rounded-[var(--ds-radius-pill)] px-2.5 py-1 text-[10px] sm:text-xs font-bold",
                selectedFixItems[0]?.status === "approved"
                  ? "bg-[var(--status-approved-bg)] text-[var(--status-approved)]"
                  : selectedFixItems[0]?.status === "pending"
                    ? "bg-[var(--status-pending-bg)] text-[var(--status-pending)]"
                    : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]"
              )}
            >
              {selectedFixItems[0]?.status === "approved" ? "確定" : selectedFixItems[0]?.status === "pending" ? "承認待ち" : "却下"}
            </span>
          )}
        </div>

        <div className="mt-3 sm:mt-4 space-y-2">
          {selectedFixItems.length === 0 ? (
            // Fixユーザーの場合は簡潔な表示
            isFixUser ? null : (
            <div className="flex flex-col items-center justify-center rounded-[var(--ds-radius-lg)] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container)]/50 py-6 sm:py-8">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-[var(--ds-radius-pill)] bg-[var(--surface-container-high)] flex items-center justify-center mb-3">
                <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--on-surface-variant)]" />
              </div>
              <p className="text-sm text-[var(--on-surface-variant)]">この日のシフトはありません</p>
            </div>
            )
          ) : (
            selectedFixItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  const req = requestById.get(item.requestId);
                  if (req) setSelectedRequest(req);
                }}
                className={cn(
                  "w-full rounded-[var(--ds-radius-md)] border-l-4 p-3 sm:p-4 text-left transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] group",
                  item.status === "approved"
                    ? "border-l-[var(--status-approved)] bg-[var(--status-approved-bg)]/50"
                    : item.status === "pending"
                      ? "border-l-[var(--status-pending)] bg-[var(--status-pending-bg)]/50"
                      : "border-l-[var(--on-surface-variant)] bg-[var(--surface-container)]"
                )}
              >
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {/* 管理者・レビュアーのみFix/Flexラベル表示 */}
                    {!isStaff && (
                    <div
                      className={cn(
                        "flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-[var(--ds-radius-md)]",
                        item.type === "fix"
                          ? "bg-[var(--primary-container)]"
                          : "bg-[var(--tertiary-container)]"
                      )}
                    >
                      <span
                        className={cn(
                          "text-[10px] sm:text-xs font-bold",
                          item.type === "fix"
                            ? "text-[var(--on-primary-container)]"
                            : "text-[var(--on-tertiary-container)]"
                        )}
                      >
                        {item.type === "fix" ? "FIX" : "FLEX"}
                      </span>
                    </div>
                    )}
                    <div className="min-w-0">
                      {!isStaff && (
                        <p className="truncate text-xs sm:text-sm font-semibold text-foreground">{item.userName}</p>
                      )}
                      {/* Fixスタッフ向け: 時間だけ大きく表示 */}
                      {isFixUser ? (
                        <p className="text-base sm:text-lg font-bold text-foreground">{item.shortLabel}</p>
                      ) : (
                        <p className="text-[11px] sm:text-xs text-[var(--on-surface-variant)] mt-0.5">{item.detailLabel}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--on-surface-variant)] transition-colors group-hover:text-foreground shrink-0" strokeWidth={2} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      )}

      {selectedRequest && (
        currentUser.role === "staff" ? (
          <StaffRequestModal
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
          />
        ) : (
          <ReviewRequestModal
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
          />
        )
      )}

      {/* iCal Settings Modal */}
      <ICalSettingsModal
        open={icalModalOpen}
        onClose={() => setIcalModalOpen(false)}
        userRole={currentUser.role}
        userId={currentUser.id}
      />
    </div>
  );
}

export default function Page() {
  return <FutureShiftsScreen />;
}
