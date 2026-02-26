"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
      className="grid h-10 w-10 place-items-center rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-high)] text-[var(--on-surface)] shadow-[0_1px_2px_rgba(0,0,0,.08)] transition-colors hover:bg-[var(--surface-container-highest)]"
    >
      <Icon className="text-[var(--on-surface)]" style={{ width: 24, height: 24 }} strokeWidth={2.8} />
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
    shortLabel: withUser ? `${name} ${timeRange}` : `Fix ${timeRange}`,
    detailLabel: `${formatJstDateLabel(start)} ${timeRange}`,
    sortIso: start,
  };
}

function asFlexEvents(req: FlexRequest, todayYmd: string, withUser: boolean): ShiftEvent[] {
  const name = req.userName ?? "不明";
  const hours = req.status === "approved" && req.approvedHours != null ? req.approvedHours : req.requestedHours;
  const shortBase = withUser ? `${name} Flex ${hours}時間` : `Flex ${hours}時間`;
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

  if (!currentUser) return null;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="page-title">今後のシフト予定</h1>
        <p className="page-subtitle">Fix / Flex の今後予定を確認できます</p>
      </div>

      <div className="surface-card px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "week"
                  ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              1週間
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "month"
                  ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              1ヶ月
            </button>
          </div>

          <div className="flex items-center gap-2">
            <PeriodStepButton direction="prev" onClick={movePrev} label="前の期間" />
            <p className="min-w-[10rem] text-center text-sm font-semibold text-foreground">{periodLabel}</p>
            <PeriodStepButton direction="next" onClick={moveNext} label="次の期間" />
            <button type="button" onClick={moveToday} className="button-secondary px-3 text-xs">今日</button>
          </div>
        </div>

      </div>

      <div className="surface-card overflow-hidden">
        <div className="grid grid-cols-7 gap-1 border-b border-border bg-muted/20 px-3 py-2">
          {WEEKDAY_LABELS.map((w) => (
            <p key={w} className="text-center text-xs font-semibold text-muted-foreground">{w}</p>
          ))}
        </div>

        {viewMode === "week" && weekFlexSummaries.length > 0 && (
          <div className="border-b border-border bg-[var(--tertiary-container)]/20 px-3 py-2">
            <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">週次Flex</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {weekFlexSummaries.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    const req = requestById.get(item.requestId);
                    if (req) setSelectedRequest(req);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] bg-card px-2.5 py-1 text-left transition-colors hover:bg-muted/30"
                >
                  {currentUser.role !== "staff" && (
                    <span className="text-[11px] font-medium text-foreground">{item.userName}</span>
                  )}
                  <span className="text-[11px] font-semibold text-[var(--on-tertiary-container)]">{item.hours}時間</span>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={cn("grid gap-1 p-2", viewMode === "week" ? "grid-cols-7" : "grid-cols-7")}>
          {calendarDays.map((day) => {
            const items = eventsByDate.get(day.ymd) ?? [];
            const fixItems = items.filter((item) => item.type === "fix");
            const isSelected = selectedDate === day.ymd;

            return (
              <button
                key={day.ymd}
                type="button"
                onClick={() => setSelectedDate(day.ymd)}
                className={cn(
                  "rounded-[var(--ds-radius-md)] border p-2 text-left transition-colors",
                  viewMode === "week" ? "min-h-[7.5rem]" : "min-h-[6rem]",
                  day.inCurrentMonth ? "bg-card" : "bg-muted/30",
                  day.isPast ? "opacity-65" : "",
                  isSelected ? "border-[var(--primary)] bg-[var(--primary-container)]/25" : "border-border hover:bg-muted/25"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      day.isToday
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : isSelected
                          ? "border border-[var(--primary)] text-[var(--primary)]"
                          : day.inCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground"
                    )}
                  >
                    {Number(day.ymd.slice(-2))}
                  </span>
                  {items.length > 0 && <span className="text-[10px] text-muted-foreground">{items.length}件</span>}
                </div>

                <div className="mt-1.5 space-y-1">
                  {viewMode === "week" ? (
                    <>
                      {fixItems.slice(0, 1).map((item) => (
                        <p
                          key={item.key}
                          className="truncate rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                        >
                          {item.shortLabel}
                        </p>
                      ))}
                      {fixItems.length > 1 && <p className="text-[10px] text-muted-foreground">Fix +{fixItems.length - 1}</p>}
                    </>
                  ) : (
                    <>
                      {items.slice(0, 2).map((item) => (
                        <p
                          key={item.key}
                          className={cn(
                            "truncate rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            item.type === "fix"
                              ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                              : "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]"
                          )}
                        >
                          {item.shortLabel}
                        </p>
                      ))}
                      {items.length > 2 && <p className="text-[10px] text-muted-foreground">+{items.length - 2}</p>}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {viewMode === "week" && weekFixSummaries.length > 0 && (
          <div className="border-t border-border bg-[var(--tertiary-container)]/20 px-3 py-2">
            <p className="text-[11px] font-semibold text-[var(--on-surface-variant)]">1週間のFix合計</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {weekFixSummaries.map((item) => (
                <span
                  key={item.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] bg-card px-2.5 py-1"
                >
                  {currentUser.role !== "staff" && (
                    <span className="text-[11px] font-medium text-foreground">{item.userName}</span>
                  )}
                  <span className="text-[11px] font-semibold text-[var(--on-primary-container)]">FIX</span>
                  <span className="text-[11px] font-semibold text-[var(--on-surface)]">合計{item.totalHours}時間</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="surface-card px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{formatJstDateLabel(`${selectedDate}T00:00:00+09:00`)}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">シフト {selectedFixItems.length}件</p>

        <div className="mt-3 space-y-2">
          {selectedFixItems.length === 0 ? (
            <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
              この日のシフトはありません。
            </div>
          ) : (
            selectedFixItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  const req = requestById.get(item.requestId);
                  if (req) setSelectedRequest(req);
                }}
                className="w-full rounded-[var(--ds-radius-md)] border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted/30 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        item.type === "fix"
                          ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                          : "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]"
                      )}
                    >
                      {item.type === "fix" ? "FIX" : "FLEX"}
                    </span>
                    {currentUser.role !== "staff" && (
                      <span className="truncate text-xs font-semibold text-foreground">{item.userName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    <ChevronRight className="text-foreground/80 transition-colors group-hover:text-foreground" style={{ width: 24, height: 24 }} strokeWidth={2.8} />
                  </div>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-foreground">{item.detailLabel}</p>
              </button>
            ))
          )}
        </div>
      </div>

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
    </div>
  );
}

export default function Page() {
  return (
    <AppShell tab="shifts">
      <FutureShiftsScreen />
    </AppShell>
  );
}
