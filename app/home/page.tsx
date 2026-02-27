"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  CalendarDays,
  Clock,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Bell,
} from "lucide-react";
import {
  formatJstTime,
  formatJstDateLabel,
  formatYmd,
  getISOWeekNumber,
  getJstDateValue,
  addDays,
  getISOMonday,
} from "@/lib/datetime";
import type { FixRequest, FlexRequest, Request } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { StaffRequestModal } from "@/components/staff-request-modal";

function HomeScreen() {
  const currentUser = useAppStore((state) => state.currentUser);
  const requests = useAppStore((state) => state.requests);
  const fetchRequests = useAppStore((state) => state.fetchRequests);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // 現在時刻を1分ごとに更新
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const todayStr = formatYmd(new Date());
  const { year: currentIsoYear, week: currentIsoWeek } = getISOWeekNumber(todayStr);
  const weekMonday = getISOMonday(todayStr);

  // 今日の日付フォーマット
  const todayLabel = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(currentTime);

  const timeLabel = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(currentTime);

  // 今日の承認済みシフト（Fix）
  const todayFixRequest = useMemo(() => {
    if (!currentUser) return null;
    return requests.find((r): r is FixRequest =>
      r.type === "fix" &&
      r.userId === currentUser.id &&
      r.status === "approved" &&
      (r.approvedStartAt ?? r.requestedStartAt).startsWith(todayStr)
    ) ?? null;
  }, [requests, currentUser, todayStr]);

  // 今週のFlexシフト
  const thisWeekFlexRequest = useMemo(() => {
    if (!currentUser) return null;
    return requests.find((r): r is FlexRequest =>
      r.type === "flex" &&
      r.userId === currentUser.id &&
      r.status === "approved" &&
      r.isoYear === currentIsoYear &&
      r.isoWeek === currentIsoWeek
    ) ?? null;
  }, [requests, currentUser, currentIsoYear, currentIsoWeek]);

  // 今週の残りのシフト（Fix）
  const upcomingFixShifts = useMemo(() => {
    if (!currentUser) return [];
    const weekEnd = addDays(weekMonday, 6);
    return requests
      .filter((r): r is FixRequest =>
        r.type === "fix" &&
        r.userId === currentUser.id &&
        r.status === "approved" &&
        getJstDateValue(r.approvedStartAt ?? r.requestedStartAt) > todayStr &&
        getJstDateValue(r.approvedStartAt ?? r.requestedStartAt) <= weekEnd
      )
      .sort((a, b) => {
        const aStart = a.approvedStartAt ?? a.requestedStartAt;
        const bStart = b.approvedStartAt ?? b.requestedStartAt;
        return aStart.localeCompare(bStart);
      })
      .slice(0, 3);
  }, [requests, currentUser, todayStr, weekMonday]);

  // 自分の申請一覧（pending/approved/rejected）
  const myRecentRequests = useMemo(() => {
    if (!currentUser) return [];
    return requests
      .filter((r) => r.userId === currentUser.id)
      .slice(0, 5);
  }, [requests, currentUser]);

  // 承認待ちの申請数（reviewer/admin用）
  const pendingRequestsCount = useMemo(() => {
    if (!currentUser || currentUser.role === "staff") return 0;
    return requests.filter((r) => r.status === "pending").length;
  }, [requests, currentUser]);

  if (!currentUser) return null;

  const isStaff = currentUser.role === "staff";
  const requestType = currentUser.requestType ?? "fix";

  return (
    <div className="w-full space-y-4">
      {/* ウェルカムヘッダー */}
      <div className="surface-card px-5 py-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[var(--on-surface-variant)]">{todayLabel}</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">
              おはようございます、{currentUser.name}さん
            </h1>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums text-[var(--primary)]">{timeLabel}</p>
          </div>
        </div>
      </div>

      {/* 今日のシフト */}
      <div className="surface-card px-5 py-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--primary-container)]">
            <CalendarDays className="h-4 w-4 text-[var(--primary)]" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">今日のシフト</h2>
        </div>

        {requestType === "fix" ? (
          todayFixRequest ? (
            <div className="rounded-[var(--ds-radius-lg)] bg-[var(--primary-container)]/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--on-surface-variant)]">勤務時間</p>
                  <p className="mt-1 text-xl font-bold text-[var(--primary)]">
                    {formatJstTime(todayFixRequest.approvedStartAt ?? todayFixRequest.requestedStartAt)} - {formatJstTime(todayFixRequest.approvedEndAt ?? todayFixRequest.requestedEndAt)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-[var(--ds-radius-pill)] bg-[var(--status-approved)]/20">
                  <CheckCircle2 className="h-6 w-6 text-[var(--status-approved)]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[var(--ds-radius-lg)] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container)]/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-pill)] bg-[var(--surface-container-high)]">
                  <Clock className="h-5 w-5 text-[var(--on-surface-variant)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">本日のシフトはありません</p>
                  <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">ゆっくりお休みください</p>
                </div>
              </div>
            </div>
          )
        ) : (
          thisWeekFlexRequest ? (
            <div className="rounded-[var(--ds-radius-lg)] bg-[var(--tertiary-container)]/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--on-surface-variant)]">今週の勤務時間</p>
                  <p className="mt-1 text-xl font-bold text-[var(--tertiary)]">
                    {thisWeekFlexRequest.approvedHours ?? thisWeekFlexRequest.requestedHours}時間
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-[var(--ds-radius-pill)] bg-[var(--status-approved)]/20">
                  <CheckCircle2 className="h-6 w-6 text-[var(--status-approved)]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[var(--ds-radius-lg)] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container)]/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-pill)] bg-[var(--surface-container-high)]">
                  <AlertCircle className="h-5 w-5 text-[var(--status-pending)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">今週のシフトが未確定です</p>
                  <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">シフト申請を提出してください</p>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* 今週の予定（Fix勤務の場合） */}
      {requestType === "fix" && upcomingFixShifts.length > 0 && (
        <div className="surface-card px-5 py-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--secondary-container)]">
              <TrendingUp className="h-4 w-4 text-[var(--secondary)]" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">今週の予定</h2>
          </div>

          <div className="space-y-2">
            {upcomingFixShifts.map((shift) => {
              const startAt = shift.approvedStartAt ?? shift.requestedStartAt;
              const endAt = shift.approvedEndAt ?? shift.requestedEndAt;
              const dateLabel = new Intl.DateTimeFormat("ja-JP", {
                timeZone: "Asia/Tokyo",
                month: "numeric",
                day: "numeric",
                weekday: "short",
              }).format(new Date(startAt));

              return (
                <div
                  key={shift.id}
                  className="flex items-center justify-between rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[60px]">
                      <p className="text-xs text-[var(--on-surface-variant)]">{dateLabel}</p>
                    </div>
                    <div className="h-8 w-px bg-[var(--outline-variant)]" />
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {formatJstTime(startAt)} - {formatJstTime(endAt)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--on-surface-variant)]" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 管理者・レビュアー向け: 承認待ち通知 */}
      {!isStaff && pendingRequestsCount > 0 && (
        <div className="surface-card px-5 py-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--status-pending)]/20">
              <Bell className="h-4 w-4 text-[var(--status-pending)]" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">承認待ち</h2>
          </div>

          <div className="rounded-[var(--ds-radius-lg)] bg-[var(--status-pending)]/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{pendingRequestsCount}件の申請が承認待ちです</p>
                <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">シフトメニューから確認してください</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-pill)] bg-[var(--status-pending)]">
                <span className="text-sm font-bold text-white">{pendingRequestsCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 自分の申請一覧 */}
      {isStaff && myRecentRequests.length > 0 && (
        <div className="surface-card px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--surface-container-high)]">
                <Clock className="h-4 w-4 text-[var(--on-surface-variant)]" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">最近の申請</h2>
            </div>
          </div>

          <div className="space-y-2">
            {myRecentRequests.map((req) => {
              const displayDate = req.type === "fix"
                ? (() => {
                    const fixReq = req;
                    const startAt = req.status === "approved"
                      ? (fixReq.approvedStartAt ?? fixReq.requestedStartAt)
                      : fixReq.requestedStartAt;
                    return formatJstDateLabel(startAt);
                  })()
                : (() => {
                    const flexReq = req as FlexRequest;
                    const start = formatJstDateLabel(`${flexReq.weekStartDate}T00:00:00+09:00`);
                    const end = formatJstDateLabel(`${addDays(flexReq.weekStartDate, 6)}T00:00:00+09:00`);
                    return `${start} から ${end}`;
                  })();

              const detail = req.type === "fix"
                ? (() => {
                    const fixReq = req;
                    const startAt = req.status === "approved"
                      ? (fixReq.approvedStartAt ?? fixReq.requestedStartAt)
                      : fixReq.requestedStartAt;
                    const endAt = req.status === "approved"
                      ? (fixReq.approvedEndAt ?? fixReq.requestedEndAt)
                      : fixReq.requestedEndAt;
                    return `${formatJstTime(startAt)} - ${formatJstTime(endAt)}`;
                  })()
                : `${(req as FlexRequest).requestedHours}時間`;

              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setSelectedRequest(req)}
                  className="w-full flex items-center justify-between gap-3 rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] p-3 text-left transition-colors hover:bg-[var(--surface-container-high)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{displayDate}</p>
                    <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">{detail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={req.status} />
                    <ChevronRight className="h-4 w-4 text-[var(--on-surface-variant)]" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedRequest && (
        <StaffRequestModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
}

export default function Page() {
  return <HomeScreen />;
}
