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
  ClipboardList,
  Clock3,
  Play,
  Search,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
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

  // 選択ユーザーが変わったら時給を取得
  useEffect(() => {
    if (selectedUserId) {
      void fetchHourlyRates(selectedUserId);
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

      <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <aside className="surface-card p-3 h-fit">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="名前・メールで検索"
              className="input-base h-9 pl-9 md:text-sm"
            />
          </div>

          {visibleUsers.length === 0 ? (
            <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
              対象ユーザーがいません。
            </div>
          ) : (
            <div className="space-y-1">
              {visibleUsers.map((u) => {
                const isActive = selectedUserId === u.id;
                const userPendingCount = pendingCountByUserId.get(u.id) ?? 0;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                      isActive
                        ? "border-primary/40 bg-primary/10"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                      {userPendingCount > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          未対応 {userPendingCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {u.requestType.toUpperCase()}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="space-y-3">
          {!selectedUser ? (
            <div className="surface-card px-4 py-8 text-sm text-muted-foreground">
              ユーザーを選択してください。
            </div>
          ) : (
            <>
              <div className="surface-card px-4 py-4 md:px-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-foreground">{selectedUser.name}</h2>
                        <span className="text-[11px] font-bold rounded-md px-2 py-0.5 bg-muted text-muted-foreground">
                          {ROLE_LABELS[selectedUser.role]}
                        </span>
                        <span className="text-[11px] font-bold rounded-md px-2 py-0.5 bg-primary/10 text-primary">
                          {selectedUser.requestType.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{selectedUser.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        承認待ち
                      </div>
                      <p className="mt-1 text-lg font-bold leading-none text-amber-700">{pendingCount}件</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <Wallet className="h-3.5 w-3.5" />
                        時給
                      </div>
                      <p className="mt-1 text-lg font-bold leading-none text-foreground">
                        {currentHourlyRate > 0 ? `${currentHourlyRate.toLocaleString()}円` : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        出勤日
                      </div>
                      <p className="mt-1 text-lg font-bold leading-none text-foreground">{workDays}日</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        推定給与
                      </div>
                      <p className="mt-1 text-lg font-bold leading-none text-foreground">
                        {currentHourlyRate > 0 ? `¥${estimatedSalary.toLocaleString()}` : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 時給設定は利用頻度が低いため、画面占有を抑えるために折りたたみ表示にする */}
              <Collapsible
                open={isRatePanelOpen}
                onOpenChange={setIsRatePanelOpen}
                className="surface-card px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">時給設定</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {currentHourlyRateEntry
                          ? `現在: ${currentHourlyRateEntry.hourlyRate.toLocaleString()}円`
                          : "未設定"}
                      </p>
                    </div>
                  </div>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/30"
                    >
                      {isRatePanelOpen ? "閉じる" : "開く"}
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isRatePanelOpen && "rotate-180")} />
                    </button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="mt-3 space-y-2">
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_96px_80px_88px]">
                      <input
                        type="number"
                        placeholder="時給（円）"
                        value={newRateAmount}
                        onChange={(e) => setNewRateAmount(e.target.value)}
                        className="input-base h-9 text-sm"
                        min={1}
                        step={1}
                      />
                      <input
                        type="number"
                        placeholder="開始年"
                        value={newRateYear}
                        onChange={(e) => setNewRateYear(e.target.value)}
                        className="input-base h-9 text-sm"
                        min={2000}
                        max={2100}
                        title="開始年"
                      />
                      <select
                        value={newRateMonth}
                        onChange={(e) => setNewRateMonth(e.target.value)}
                        className="input-base h-9 text-sm"
                        title="開始月を選択"
                      >
                        <option value="">月</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                          <option key={month} value={String(month)}>
                            {month}月
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleSaveHourlyRate}
                        className="button-primary h-9 px-3 text-xs"
                      >
                        保存
                      </button>
                    </div>
                  </div>

                  {hourlyRatesLoading ? (
                    <div className="text-xs text-muted-foreground">読み込み中...</div>
                  ) : sortedHourlyRates.length === 0 ? (
                    <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground text-center">
                      履歴はまだありません
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-card divide-y divide-border/70">
                      {sortedHourlyRates.map((rate) => (
                        <div
                          key={rate.id}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {rate.hourlyRate.toLocaleString()}円
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {rate.effectiveFrom
                                ? `${formatEffectiveFromLabel(rate.effectiveFrom)}から`
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
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* 勤怠セクション */}
              <div className="surface-card p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">勤怠</h3>
                  </div>
                  <select
                    value={periodKey}
                    onChange={(e) => setPeriodKey(e.target.value)}
                    className="text-xs border border-border rounded-md px-2 py-1 bg-background"
                    title="期間を選択"
                  >
                    {periodOptions.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted/30 p-2">
                    <div className="text-xs text-muted-foreground">勤務時間</div>
                    <div className="text-sm font-semibold">{Math.floor(totalWorkMinutes / 60)}h{totalWorkMinutes % 60}m</div>
                  </div>
                  <div className="rounded-md bg-muted/30 p-2">
                    <div className="text-xs text-muted-foreground">出勤日数</div>
                    <div className="text-sm font-semibold">{workDays}日</div>
                  </div>
                  <div className="rounded-md bg-muted/30 p-2">
                    <div className="text-xs text-muted-foreground">推定給与</div>
                    <div className="text-sm font-semibold">
                      {currentHourlyRate > 0 ? `¥${estimatedSalary.toLocaleString()}` : "時給未設定"}
                    </div>
                  </div>
                </div>
                {attendanceLoading ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">読み込み中...</div>
                ) : attendanceSessions.length === 0 ? (
                  <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                    この期間の勤怠データがありません。
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {attendanceSessions
                      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
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
                          <div
                            key={session.id}
                            className="flex items-center justify-between text-xs rounded-md border border-border bg-card px-2.5 py-1.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium shrink-0">{dateLabel}</span>
                              <span className="text-muted-foreground truncate">{timeLabel}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {clockOut ? (
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {Math.floor(workMin / 60)}h{workMin % 60}m
                                  {breakMin > 0 && (
                                    <span className="text-muted-foreground ml-1">(休憩{breakMin}m)</span>
                                  )}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Play className="h-3 w-3" />
                                  勤務中
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="surface-card p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">申請一覧</h3>
                      <p className="text-[11px] text-muted-foreground">{filteredUserRequests.length}件を表示中</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    承認待ち {requestStatusCounts.pending}件
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
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
                          "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                          requestTypeFilter === value
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted/30"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
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
                          "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                          requestStatusFilter === value
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted/30"
                        )}
                      >
                        {label} {count}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredUserRequests.length === 0 ? (
                  <div className="mt-4 rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-3 py-6 text-xs text-center text-muted-foreground">
                    条件に一致する申請はありません。
                  </div>
                ) : (
                  <div className="mt-4 space-y-2 max-h-[720px] overflow-y-auto pr-1">
                    {filteredUserRequests.map((req) => {
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
                          ? `${formatJstDateLabel(fixStart)}${formatJstDateLabel(fixStart) !== formatJstDateLabel(fixEnd) ? ` → ${formatJstDateLabel(fixEnd)}` : ""}`
                          : "";
                      const hoursLabel = isFlex && flexReq
                        ? getFlexHoursLabel(flexReq)
                        : fixStart && fixEnd
                          ? `${req.status === "approved" ? "確定" : "申請"} ${formatJstTime(fixStart)}–${formatJstTime(fixEnd)}`
                          : "";
                      const TypeIcon = isFlex ? Calendar : Clock3;
                      const accentClass = req.status === "pending"
                        ? "border-l-amber-400"
                        : req.status === "approved"
                          ? "border-l-emerald-400"
                          : req.status === "rejected"
                            ? "border-l-rose-400"
                            : "border-l-slate-400";
                      return (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => setSelectedRequest(req)}
                          className={cn(
                            "w-full rounded-[var(--ds-radius-md)] border border-border border-l-4 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/30 group",
                            accentClass
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                                <TypeIcon className="h-3.5 w-3.5" />
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
                              className="shrink-0 text-foreground/80 transition-colors group-hover:text-foreground"
                              style={{ width: 22, height: 22 }}
                              strokeWidth={2.8}
                            />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{periodLabel}</p>
                          <p className="mt-1 text-base font-bold tabular-nums text-foreground">{hoursLabel}</p>
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            申請日時: {formatJstDateTime(req.createdAt)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
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
    </div>
  );
}

function getFlexHoursLabel(request: FlexRequest): string {
  if (request.status === "approved" && request.approvedHours != null) {
    return `確定 ${request.approvedHours}時間`;
  }
  return `申請 ${request.requestedHours}時間`;
}
