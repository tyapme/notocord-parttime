"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { FixRequest, FlexRequest, Request, User, HourlyRate, Status } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import {
  formatIsoWeekLabel,
  formatJstDateLabel,
  formatJstDateTime,
  formatJstTime,
} from "@/lib/datetime";
import { sortRequestsByWorkDateNearest } from "@/lib/request-list";
import { getApprovalSummary, isProxyRequest } from "@/lib/request-meta";
import { ReviewRequestModal } from "@/app/review/review-request-modal";
import { MetaTag, TypeTag } from "@/components/shift-request-ui";
import {
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock3,
  Play,
  Search,
  Trash2,
  User as UserIcon,
  Wallet,
  X,
} from "lucide-react";
import { AttendanceDetailModal } from "@/components/attendance-detail-modal";
import {
  formatEffectiveFromLabel,
  getApplicableHourlyRate,
  getHourlyRates,
  deleteHourlyRate,
  setHourlyRate,
  sortHourlyRatesByEffectiveFromDesc,
} from "@/lib/hourly-rate";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  getAttendanceSessions,
  getWorkMinutesDb,
  getBreakMinutesDb,
  AttendanceSessionDb,
} from "@/lib/attendance-db";
import { getCurrentClosingPeriod, AttendancePeriod } from "@/lib/attendance";
import { formatYmd } from "@/lib/datetime";

interface PeriodOption {
  key: string;
  period: AttendancePeriod;
  label: string;
}

function buildPeriodOptions(base: Date = new Date(), count = 6): PeriodOption[] {
  const options: PeriodOption[] = [];
  let cursor = new Date(base);
  const seen = new Set<string>();
  while (options.length < count) {
    const period = getCurrentClosingPeriod(cursor);
    const key = `${period.startAt}_${period.endAt}`;
    if (!seen.has(key)) {
      options.push({ key, period, label: period.label });
      seen.add(key);
    }
    cursor = new Date(new Date(period.startAt).getTime() - 24 * 60 * 60 * 1000);
  }
  return options;
}

const ROLE_LABELS: Record<User["role"], string> = {
  staff: "アルバイト",
  reviewer: "レビュアー",
  admin: "管理者",
};

export function UsersDetailScreen() {
  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const requests = useAppStore((s) => s.requests);
  const fetchUsers = useAppStore((s) => s.fetchUsers);
  const fetchRequests = useAppStore((s) => s.fetchRequests);

  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState<Status | "all">("all");
  const [requestTypeFilter, setRequestTypeFilter] = useState<Request["type"] | "all">("all");
  const [attendanceExpanded, setAttendanceExpanded] = useState(false);
  const [requestsExpanded, setRequestsExpanded] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceSessionDb | null>(null);
  const { toast } = useToast();

  // 時給関連のstate
  const [hourlyRates, setHourlyRates] = useState<HourlyRate[]>([]);
  const [hourlyRatesLoading, setHourlyRatesLoading] = useState(false);
  const [isRatePanelOpen, setIsRatePanelOpen] = useState(false);
  const [newRateYear, setNewRateYear] = useState("");
  const [newRateMonth, setNewRateMonth] = useState("");
  const [newRateAmount, setNewRateAmount] = useState("");

  // 勤怠関連のstate
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSessionDb[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const periodOptions = useMemo(() => buildPeriodOptions(), []);
  const [periodKey, setPeriodKey] = useState(periodOptions[0]?.key ?? "");
  const currentPeriod = useMemo(
    () => periodOptions.find((item: PeriodOption) => item.key === periodKey)?.period ?? getCurrentClosingPeriod(),
    [periodOptions, periodKey]
  );

  const fetchHourlyRates = useCallback(async (userId: string) => {
    setHourlyRatesLoading(true);
    const result = await getHourlyRates(userId);
    if (result.ok && result.data) {
      setHourlyRates(result.data);
    }
    setHourlyRatesLoading(false);
  }, []);

  const fetchAttendanceSessions = useCallback(async (userId: string, startDate: string, endDate: string) => {
    setAttendanceLoading(true);
    const result = await getAttendanceSessions({ userId, startDate, endDate });
    if (result.ok && result.data) {
      setAttendanceSessions(result.data);
    }
    setAttendanceLoading(false);
  }, []);

  useEffect(() => {
    void Promise.all([fetchUsers(), fetchRequests()]);
  }, [fetchUsers, fetchRequests]);

  // 選択ユーザーが変わったら時給を取得し、展開状態をリセット
  useEffect(() => {
    if (selectedUserId) {
      void fetchHourlyRates(selectedUserId);
      setAttendanceExpanded(false);
      setRequestsExpanded(false);
    } else {
      setHourlyRates([]);
    }
  }, [selectedUserId, fetchHourlyRates]);

  // 選択ユーザーまたは期間が変わったら勤怠を取得
  useEffect(() => {
    if (selectedUserId) {
      const startDate = currentPeriod.startAt.split("T")[0];
      const endDate = currentPeriod.endAt.split("T")[0];
      void fetchAttendanceSessions(selectedUserId, startDate, endDate);
    } else {
      setAttendanceSessions([]);
    }
  }, [selectedUserId, currentPeriod, fetchAttendanceSessions]);

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => u.active && u.role === "staff")
      .filter((u) => {
        if (!q) return true;
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }, [users, query]);
  const pendingCountByUserId = useMemo(() => {
    const map = new Map<string, number>();
    for (const req of requests) {
      if (req.status !== "pending") continue;
      map.set(req.userId, (map.get(req.userId) ?? 0) + 1);
    }
    return map;
  }, [requests]);

  useEffect(() => {
    if (!visibleUsers.length) {
      setSelectedUserId("");
      return;
    }
    if (!selectedUserId || !visibleUsers.some((u) => u.id === selectedUserId)) {
      setSelectedUserId(visibleUsers[0].id);
    }
  }, [visibleUsers, selectedUserId]);

  useEffect(() => {
    setSelectedRequest(null);
    setIsRatePanelOpen(false);
    setNewRateYear("");
    setNewRateMonth("");
    setNewRateAmount("");
    setRequestStatusFilter("all");
    setRequestTypeFilter("all");
  }, [selectedUserId]);

  const selectedUser =
    visibleUsers.find((u) => u.id === selectedUserId) ||
    users.find((u) => u.id === selectedUserId) ||
    null;

  const userRequests = useMemo(() => {
    if (!selectedUser) return [] as Request[];
    return sortRequestsByWorkDateNearest(requests.filter((r) => r.userId === selectedUser.id));
  }, [requests, selectedUser]);

  const pendingCount = useMemo(
    () => userRequests.filter((req) => req.status === "pending").length,
    [userRequests]
  );
  const periodEndDate = currentPeriod.endAt.split("T")[0];
  const sortedHourlyRates = useMemo(
    () => sortHourlyRatesByEffectiveFromDesc(hourlyRates),
    [hourlyRates]
  );
  const currentHourlyRateEntry = useMemo(
    () => getApplicableHourlyRate(hourlyRates, periodEndDate),
    [hourlyRates, periodEndDate]
  );
  const filteredUserRequests = useMemo(
    () =>
      userRequests.filter((req) => {
        if (requestStatusFilter !== "all" && req.status !== requestStatusFilter) return false;
        if (requestTypeFilter !== "all" && req.type !== requestTypeFilter) return false;
        return true;
      }),
    [requestStatusFilter, requestTypeFilter, userRequests]
  );
  const requestStatusCounts = useMemo(
    () =>
      userRequests.reduce<Record<Status, number>>(
        (acc, req) => {
          acc[req.status] += 1;
          return acc;
        },
        { pending: 0, approved: 0, rejected: 0, withdrawn: 0 }
      ),
    [userRequests]
  );
  const totalWorkMinutes = useMemo(
    () => attendanceSessions.reduce((sum, session) => sum + getWorkMinutesDb(session), 0),
    [attendanceSessions]
  );
  const workDays = useMemo(
    () => new Set(attendanceSessions.map((session) => formatYmd(new Date(session.start_at)))).size,
    [attendanceSessions]
  );
  const currentHourlyRate = currentHourlyRateEntry?.hourlyRate ?? 0;
  const estimatedSalary = Math.floor((totalWorkMinutes / 60) * currentHourlyRate);
  const handleSaveHourlyRate = useCallback(async () => {
    if (!selectedUserId) return;
    const amount = Number(newRateAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast({ description: "時給を正しく入力してください", variant: "destructive" });
      return;
    }

    const yearInput = newRateYear.trim();
    const monthInput = newRateMonth.trim();
    let effectiveFrom: string | null = null;

    if (yearInput || monthInput) {
      if (!yearInput || !monthInput) {
        toast({ description: "開始日は年と月の両方を入力してください", variant: "destructive" });
        return;
      }
      const year = Number(yearInput);
      const month = Number(monthInput);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        toast({ description: "開始年は 2000〜2100 の範囲で入力してください", variant: "destructive" });
        return;
      }
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        toast({ description: "開始月は 1〜12 の範囲で入力してください", variant: "destructive" });
        return;
      }
      effectiveFrom = `${year}-${String(month).padStart(2, "0")}-21`;
    }

    const result = await setHourlyRate(selectedUserId, amount, effectiveFrom);
    if (result.ok) {
      toast({ description: "時給を設定しました" });
      setNewRateAmount("");
      setNewRateYear("");
      setNewRateMonth("");
      void fetchHourlyRates(selectedUserId);
      return;
    }
    toast({ description: result.error, variant: "destructive" });
  }, [fetchHourlyRates, newRateAmount, newRateMonth, newRateYear, selectedUserId, toast]);

  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "reviewer")) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="page-title">ユーザー詳細</h1>
        <p className="text-xs text-muted-foreground mt-0.5">アルバイトごとの申請状況を確認できます</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] gap-5">
        {/* サイドバー - ユーザーリスト */}
        <aside className="surface-card p-4 h-fit md:sticky md:top-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索..."
              className="input-base h-10 pl-10 pr-8 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="text-xs text-muted-foreground mb-2 px-1">
            {visibleUsers.length}名のスタッフ
          </div>

          {visibleUsers.length === 0 ? (
            <div className="rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-6 text-sm text-muted-foreground text-center">
              対象ユーザーがいません
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleUsers.map((u) => {
                const isActive = selectedUserId === u.id;
                const userPendingCount = pendingCountByUserId.get(u.id) ?? 0;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    aria-label={`${u.name} (${u.email})`}
                    className={cn(
                      "w-full rounded-[var(--ds-radius-md)] border px-3 py-3 text-left transition-all",
                      isActive
                        ? "border-[var(--primary)] bg-[var(--primary-container)]"
                        : "border-transparent bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] hover:border-[var(--outline-variant)]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ds-radius-pill)] text-sm font-medium",
                        isActive 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-[var(--surface-container-high)] text-muted-foreground"
                      )}>
                        {u.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-end gap-2">
                          {userPendingCount > 0 && (
                            <span className="shrink-0 rounded-[var(--ds-radius-pill)] bg-[var(--status-pending-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-pending)]">
                              {userPendingCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{u.email}</p>
                        <span className={cn(
                          "inline-block mt-1.5 text-[10px] font-bold rounded-[var(--ds-radius-sm)] px-1.5 py-0.5",
                          u.requestType === "flex" 
                            ? "bg-accent text-accent-foreground" 
                            : "bg-[var(--surface-container-high)] text-muted-foreground"
                        )}>
                          {u.requestType.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* メインコンテンツ */}
        <section className="space-y-4">
          {!selectedUser ? (
            <div className="surface-card px-6 py-12 text-center">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-[var(--ds-radius-pill)] bg-[var(--surface-container)] text-muted-foreground mb-4">
                <UserIcon className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">ユーザーを選択してください</p>
            </div>
          ) : (
            <>
              {/* ��ーザー情報ヘッダー */}
              <div className="surface-card px-5 py-5">
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--ds-radius-pill)] bg-primary text-primary-foreground text-xl font-semibold">
                    {selectedUser.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold rounded-[var(--ds-radius-sm)] px-2 py-0.5 bg-[var(--surface-container-high)] text-muted-foreground uppercase tracking-wide">
                        {ROLE_LABELS[selectedUser.role]}
                      </span>
                      <span className={cn(
                        "text-[10px] font-bold rounded-[var(--ds-radius-sm)] px-2 py-0.5 uppercase tracking-wide",
                        selectedUser.requestType === "flex" 
                          ? "bg-accent text-accent-foreground" 
                          : "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                      )}>
                        {selectedUser.requestType}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{selectedUser.email}</p>
                  </div>
                </div>

                {/* 統計カード */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className={cn(
                    "rounded-[var(--ds-radius-md)] px-4 py-3 transition-colors",
                    pendingCount > 0 
                      ? "bg-[var(--status-pending-bg)] border border-[var(--status-pending)]/20" 
                      : "bg-[var(--surface-container)] border border-transparent"
                  )}>
                    <div className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      pendingCount > 0 ? "text-[var(--status-pending)]" : "text-muted-foreground"
                    )}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      承認待ち
                    </div>
                    <p className={cn(
                      "mt-1.5 text-2xl font-bold leading-none tabular-nums",
                      pendingCount > 0 ? "text-[var(--status-pending)]" : "text-foreground"
                    )}>
                      {pendingCount}<span className="text-sm font-medium ml-0.5">件</span>
                    </p>
                  </div>
                  <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" />
                      時給
                    </div>
                    <p className="mt-1.5 text-2xl font-bold leading-none text-foreground tabular-nums">
                      {currentHourlyRate > 0 ? (
                        <>{currentHourlyRate.toLocaleString()}<span className="text-sm font-medium ml-0.5">円</span></>
                      ) : "-"}
                    </p>
                  </div>
                  <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      出勤日
                    </div>
                    <p className="mt-1.5 text-2xl font-bold leading-none text-foreground tabular-nums">
                      {workDays}<span className="text-sm font-medium ml-0.5">日</span>
                    </p>
                  </div>
                  <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      推定給与
                    </div>
                    <p className="mt-1.5 text-2xl font-bold leading-none text-foreground tabular-nums">
                      {currentHourlyRate > 0 ? (
                        <><span className="text-base">¥</span>{estimatedSalary.toLocaleString()}</>
                      ) : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 時給設定 */}
              <Collapsible
                open={isRatePanelOpen}
                onOpenChange={setIsRatePanelOpen}
                className="surface-card overflow-hidden"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--primary-container)] text-primary">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-semibold text-foreground">時給設定</h3>
                        <p className="text-xs text-muted-foreground">
                          {currentHourlyRateEntry
                            ? `現在 ${currentHourlyRateEntry.hourlyRate.toLocaleString()}円`
                            : "未設定"}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      "h-5 w-5 text-muted-foreground transition-transform duration-200",
                      isRatePanelOpen && "rotate-180"
                    )} />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-5 pb-5 space-y-4">
                    <div className="rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-3">新しい時給を設定</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px_90px] sm:items-end">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">時給（円）</label>
                          <input
                            type="number"
                            placeholder="1500"
                            value={newRateAmount}
                            onChange={(e) => setNewRateAmount(e.target.value)}
                            className="input-base h-10 text-sm"
                            min={1}
                            step={1}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">開始年</label>
                          <input
                            type="number"
                            placeholder="2026"
                            value={newRateYear}
                            onChange={(e) => setNewRateYear(e.target.value)}
                            className="input-base h-10 text-sm"
                            min={2000}
                            max={2100}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">開始月</label>
                          <select
                            value={newRateMonth}
                            onChange={(e) => setNewRateMonth(e.target.value)}
                            className="input-base h-10 text-sm"
                          >
                            <option value="">選択</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                              <option key={month} value={String(month)}>
                                {month}月
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveHourlyRate}
                        className="button-primary w-full mt-4 h-10 text-sm"
                      >
                        保存する
                      </button>
                    </div>

                    {hourlyRatesLoading ? (
                      <div className="text-sm text-muted-foreground text-center py-4">読み込み中...</div>
                    ) : sortedHourlyRates.length === 0 ? (
                      <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-6 text-sm text-muted-foreground text-center">
                        履歴はまだありません
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">設定履歴</p>
                        <div className="rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-card divide-y divide-[var(--outline-variant)]/50 overflow-hidden">
                          {sortedHourlyRates.map((rate) => (
                            <div
                              key={rate.id}
                              className="flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-container)] transition-colors"
                            >
                              <div>
                                <p className="text-sm font-bold text-foreground tabular-nums">
                                  {rate.hourlyRate.toLocaleString()}円
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {rate.effectiveFrom
                                    ? `${formatEffectiveFromLabel(rate.effectiveFrom)}から適用`
                                    : formatEffectiveFromLabel(rate.effectiveFrom)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  const result = await deleteHourlyRate(rate.id);
                                  if (result.ok) {
                                    toast({ description: "時給設定を削除しました" });
                                    void fetchHourlyRates(selectedUserId);
                                  } else {
                                    toast({ description: result.error, variant: "destructive" });
                                  }
                                }}
                                className="p-2 rounded-[var(--ds-radius-sm)] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="削除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* 勤怠セクション */}
              <div className="surface-card p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--primary-container)] text-primary">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">勤怠記録</h3>
                  </div>
                  <select
                    value={periodKey}
                    onChange={(e) => setPeriodKey(e.target.value)}
                    className="text-sm border border-[var(--outline-variant)] rounded-[var(--ds-radius-md)] px-3 py-2 bg-[var(--surface-container-lowest)] min-w-[160px]"
                    title="期間を選択"
                  >
                    {periodOptions.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">勤務時間</div>
                    <div className="text-lg font-bold tabular-nums">{Math.floor(totalWorkMinutes / 60)}h{totalWorkMinutes % 60}m</div>
                  </div>
                  <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">出勤日数</div>
                    <div className="text-lg font-bold tabular-nums">{workDays}日</div>
                  </div>
                  <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">推定給与</div>
                    <div className="text-lg font-bold tabular-nums">
                      {currentHourlyRate > 0 ? `¥${estimatedSalary.toLocaleString()}` : "-"}
                    </div>
                  </div>
                </div>

                {attendanceLoading ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">読み込み中...</div>
                ) : attendanceSessions.length === 0 ? (
                  <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-8 text-sm text-muted-foreground text-center">
                    この期間の勤怠データがありません
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {attendanceSessions
                        .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
                        .slice(0, attendanceExpanded ? undefined : 5)
                        .map((session) => {
                          const clockIn = new Date(session.start_at);
                          const clockOut = session.end_at ? new Date(session.end_at) : null;
                          const workMin = getWorkMinutesDb(session);
                          const breakMin = getBreakMinutesDb(session);
                          const dateLabel = `${clockIn.getMonth() + 1}/${clockIn.getDate()}`;
                          const timeLabel = clockOut
                            ? `${clockIn.getHours().toString().padStart(2, "0")}:${clockIn.getMinutes().toString().padStart(2, "0")} - ${clockOut.getHours().toString().padStart(2, "0")}:${clockOut.getMinutes().toString().padStart(2, "0")}`
                            : `${clockIn.getHours().toString().padStart(2, "0")}:${clockIn.getMinutes().toString().padStart(2, "0")} - 勤務中`;
                          return (
                            <button
                              key={session.id}
                              type="button"
                              onClick={() => setSelectedAttendance(session)}
                              className="w-full flex items-center justify-between rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-card px-4 py-3 text-left transition-all hover:bg-[var(--surface-container)] group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--surface-container)] text-muted-foreground group-hover:bg-[var(--surface-container-high)]">
                                  <Calendar className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium">{dateLabel}</span>
                                  <span className="text-sm text-muted-foreground ml-2">{timeLabel}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {clockOut ? (
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <CheckCircle2 className="h-4 w-4 text-[var(--status-approved)]" />
                                    <span className="font-medium tabular-nums">{Math.floor(workMin / 60)}h{workMin % 60}m</span>
                                    {breakMin > 0 && (
                                      <span className="text-xs text-muted-foreground">(休憩{breakMin}m)</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-sm text-primary">
                                    <Play className="h-4 w-4" />
                                    <span className="font-medium">勤務中</span>
                                  </div>
                                )}
                                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                              </div>
                            </button>
                          );
                        })}
                    </div>
                    {attendanceSessions.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setAttendanceExpanded(!attendanceExpanded)}
                        className="w-full mt-3 flex items-center justify-center gap-1.5 rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-[var(--surface-container)] hover:text-foreground transition-colors"
                      >
                        {attendanceExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            折りたたむ
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            すべて表示（{attendanceSessions.length}件）
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* 申請一覧 */}
              <div className="surface-card p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--primary-container)] text-primary">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">申請一覧</h3>
                      <p className="text-xs text-muted-foreground">{filteredUserRequests.length}件を表示中</p>
                    </div>
                  </div>
                  {requestStatusCounts.pending > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--status-pending)] bg-[var(--status-pending-bg)] px-3 py-1.5 rounded-[var(--ds-radius-pill)]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      承認待ち {requestStatusCounts.pending}件
                    </div>
                  )}
                </div>

                {/* フィルター */}
                <div className="space-y-3 mb-4">
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["all", "すべて"],
                      ["fix", "FIX"],
                      ["flex", "FLEX"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRequestTypeFilter(value)}
                        className={cn(
                          "rounded-[var(--ds-radius-pill)] border px-3 py-1.5 text-xs font-medium transition-all",
                          requestTypeFilter === value
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-muted-foreground hover:bg-[var(--surface-container)]"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["all", "すべて", userRequests.length],
                      ["pending", "承認待ち", requestStatusCounts.pending],
                      ["approved", "承認済み", requestStatusCounts.approved],
                      ["rejected", "却下", requestStatusCounts.rejected],
                      ["withdrawn", "取り下げ", requestStatusCounts.withdrawn],
                    ] as const).map(([value, label, count]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRequestStatusFilter(value)}
                        className={cn(
                          "rounded-[var(--ds-radius-pill)] border px-3 py-1.5 text-xs font-medium transition-all",
                          requestStatusFilter === value
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-muted-foreground hover:bg-[var(--surface-container)]"
                        )}
                      >
                        {label} <span className="tabular-nums">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {filteredUserRequests.length === 0 ? (
                  <div className="rounded-[var(--ds-radius-md)] border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-10 text-sm text-center text-muted-foreground">
                    条件に一致する申請はありません
                  </div>
                ) : (
                  <>
                  <div className="space-y-2">
                    {filteredUserRequests.slice(0, requestsExpanded ? undefined : 5).map((req) => {
                      const approval = getApprovalSummary(req);
                      const isFlex = req.type === "flex";
                      const flexReq = isFlex ? (req as FlexRequest) : null;
                      const fixReq = isFlex ? null : (req as FixRequest);
                      const fixStart = fixReq
                        ? req.status === "approved" && fixReq.approvedStartAt
                          ? fixReq.approvedStartAt
                          : fixReq.requestedStartAt
                        : null;
                      const fixEnd = fixReq
                        ? req.status === "approved" && fixReq.approvedEndAt
                          ? fixReq.approvedEndAt
                          : fixReq.requestedEndAt
                        : null;
                      const periodLabel = isFlex && flexReq
                        ? formatIsoWeekLabel(flexReq.isoYear, flexReq.isoWeek, flexReq.weekStartDate)
                        : fixStart && fixEnd
                          ? `${formatJstDateLabel(fixStart)}${formatJstDateLabel(fixStart) !== formatJstDateLabel(fixEnd) ? ` - ${formatJstDateLabel(fixEnd)}` : ""}`
                          : "";
                      const hoursLabel = isFlex && flexReq
                        ? getFlexHoursLabel(flexReq)
                        : fixStart && fixEnd
                          ? `${req.status === "approved" ? "確定" : "申請"} ${formatJstTime(fixStart)} - ${formatJstTime(fixEnd)}`
                          : "";
                      const TypeIcon = isFlex ? Calendar : Clock3;
                      const accentClass = req.status === "pending"
                        ? "border-l-[var(--status-pending)]"
                        : req.status === "approved"
                          ? "border-l-[var(--status-approved)]"
                          : req.status === "rejected"
                            ? "border-l-[var(--status-rejected)]"
                            : "border-l-[var(--status-withdrawn)]";
                      return (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => setSelectedRequest(req)}
                          className={cn(
                            "w-full rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] border-l-4 bg-card px-4 py-4 text-left transition-all hover:bg-[var(--surface-container)] hover:shadow-sm group",
                            accentClass
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="flex h-7 w-7 items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--surface-container)] text-muted-foreground">
                                <TypeIcon className="h-4 w-4" />
                              </span>
                              <TypeTag type={req.type} />
                              <StatusBadge status={req.status} />
                              {isProxyRequest(req) && (
                                <MetaTag kind="proxy">
                                  {req.createdByName ? `代理（${req.createdByName}）` : "代理"}
                                </MetaTag>
                              )}
                              {approval && (
                                <MetaTag kind={approval.tone === "full" ? "ok" : "warn"}>
                                  {approval.label}
                                </MetaTag>
                              )}
                            </div>
                            <ChevronRight
                              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                              style={{ width: 20, height: 20 }}
                              strokeWidth={2}
                            />
                          </div>
                          <div className="mt-3 pl-9">
                            <p className="text-xs text-muted-foreground">{periodLabel}</p>
                            <p className="mt-0.5 text-base font-bold tabular-nums text-foreground">{hoursLabel}</p>
                            <p className="text-[11px] text-muted-foreground mt-2">
                              申請日時: {formatJstDateTime(req.createdAt)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {filteredUserRequests.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setRequestsExpanded(!requestsExpanded)}
                      className="w-full mt-3 flex items-center justify-center gap-1.5 rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-[var(--surface-container)] hover:text-foreground transition-colors"
                    >
                      {requestsExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          折りたたむ
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          すべて表示（{filteredUserRequests.length}件）
                        </>
                      )}
                    </button>
                  )}
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {selectedRequest && (
        <ReviewRequestModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}

      {selectedAttendance && (
        <AttendanceDetailModal
          session={selectedAttendance}
          onClose={() => setSelectedAttendance(null)}
          hourlyRate={currentHourlyRate}
        />
      )}
    </div>
  );
}

function getFlexHoursLabel(request: FlexRequest): string {
  if (request.status === "approved" && request.approvedHours != null) {
    return `確定 ${request.approvedHours}時間`;
  }
  return `申請 ${request.requestedHours}時間`;
}
