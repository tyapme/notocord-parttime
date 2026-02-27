"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { FixRequest, FlexRequest, Request, User, HourlyRate } from "@/lib/types";
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
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  getHourlyRates,
  setHourlyRate,
  deleteHourlyRate,
  getClosingDate,
  formatEffectiveUntilLabel,
} from "@/lib/hourly-rate";
import { useToast } from "@/hooks/use-toast";
import {
  getAttendanceSessions,
  getWorkMinutesDb,
  getBreakMinutesDb,
  AttendanceSessionDb,
} from "@/lib/attendance-db";
import { getCurrentClosingPeriod, AttendancePeriod } from "@/lib/attendance";
import { formatYmd } from "@/lib/datetime";
import { Calendar, Play, CheckCircle2 } from "lucide-react";

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
  const { toast } = useToast();

  // 時給関連のstate
  const [hourlyRates, setHourlyRates] = useState<HourlyRate[]>([]);
  const [hourlyRatesLoading, setHourlyRatesLoading] = useState(false);
  const [showAddRateForm, setShowAddRateForm] = useState(false);
  const [newRateYear, setNewRateYear] = useState(new Date().getFullYear());
  const [newRateMonth, setNewRateMonth] = useState(new Date().getMonth() + 1);
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
          <div className="space-y-2 mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="名前・メールで検索"
              className="input-base h-9 md:text-sm"
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
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                      isActive
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
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
              <div className="surface-card px-4 py-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-foreground">{selectedUser.name}</h2>
                  <span className="text-[11px] font-bold rounded-md px-2 py-0.5 bg-muted text-muted-foreground">
                    {ROLE_LABELS[selectedUser.role]}
                  </span>
                  <span className="text-[11px] font-bold rounded-md px-2 py-0.5 bg-primary/10 text-primary">
                    {selectedUser.requestType.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{selectedUser.email}</p>
              </div>

              <div
                className={cn(
                  "rounded-[var(--ds-radius-lg)] border px-4 py-3",
                  pendingCount > 0
                    ? "border-amber-300 bg-amber-50/80"
                    : "border-border bg-muted/30"
                )}
              >
                <p className="text-xs font-semibold text-muted-foreground">承認待ち</p>
                <p
                  className={cn(
                    "text-2xl font-semibold leading-none mt-1",
                    pendingCount > 0 ? "text-amber-700" : "text-foreground"
                  )}
                >
                  {pendingCount}件
                </p>
                {pendingCount > 0 && (
                  <p className="text-xs font-medium text-amber-700 mt-1">対応が必要です</p>
                )}
              </div>

              {/* 時給設定セクション */}
              <div className="surface-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">時給設定</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddRateForm(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
                  >
                    <Plus className="h-4 w-4" />
                    追加
                  </button>
                </div>

                {showAddRateForm && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 mb-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={newRateYear}
                        onChange={(e) => setNewRateYear(Number(e.target.value))}
                        className="input-base h-9 text-sm w-24"
                        title="年を選択"
                      >
                        {[2024, 2025, 2026, 2027, 2028].map((y) => (
                          <option key={y} value={y}>{y}年</option>
                        ))}
                      </select>
                      <select
                        value={newRateMonth}
                        onChange={(e) => setNewRateMonth(Number(e.target.value))}
                        className="input-base h-9 text-sm w-20"
                        title="月を選択"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>{m}月分</option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">まで</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="時給（円）"
                        value={newRateAmount}
                        onChange={(e) => setNewRateAmount(e.target.value)}
                        className="input-base h-9 text-sm flex-1"
                        min={0}
                      />
                      <span className="text-xs text-muted-foreground">円</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddRateForm(false);
                          setNewRateAmount("");
                        }}
                        className="button-secondary flex-1 h-9 text-xs"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const amount = Number(newRateAmount);
                          if (!amount || amount <= 0) {
                            toast({ description: "時給を入力してください", variant: "destructive" });
                            return;
                          }
                          const effectiveUntil = getClosingDate(newRateYear, newRateMonth);
                          const result = await setHourlyRate(selectedUserId, amount, effectiveUntil);
                          if (result.ok) {
                            toast({ description: "時給を設定しました" });
                            setShowAddRateForm(false);
                            setNewRateAmount("");
                            void fetchHourlyRates(selectedUserId);
                          } else {
                            toast({ description: result.error, variant: "destructive" });
                          }
                        }}
                        className="button-primary flex-1 h-9 text-xs"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                )}

                {hourlyRatesLoading ? (
                  <div className="text-xs text-muted-foreground">読み込み中...</div>
                ) : hourlyRates.length === 0 ? (
                  <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                    時給が設定されていません
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hourlyRates.map((rate) => (
                      <div
                        key={rate.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {rate.hourlyRate.toLocaleString()}円
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatEffectiveUntilLabel(rate.effectiveUntil)}まで
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
              </div>

              {/* 勤怠セクション */}
              <div className="surface-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">勤怠</h3>
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
                {attendanceLoading ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">読み込み中...</div>
                ) : attendanceSessions.length === 0 ? (
                  <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                    この期間の勤怠データがありません。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* サマリー */}
                    {(() => {
                      const totalWorkMinutes = attendanceSessions.reduce(
                        (sum, s) => sum + getWorkMinutesDb(s),
                        0
                      );
                      const workDays = new Set(
                        attendanceSessions.map((s) => formatYmd(new Date(s.start_at)))
                      ).size;
                      const currentHourlyRate = hourlyRates.length > 0
                        ? hourlyRates.sort((a, b) => a.effectiveUntil.localeCompare(b.effectiveUntil))[0]?.hourlyRate ?? 0
                        : 0;
                      const estimatedSalary = Math.floor((totalWorkMinutes / 60) * currentHourlyRate);
                      return (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-muted/30 rounded-md p-2">
                            <div className="text-xs text-muted-foreground">勤務時間</div>
                            <div className="text-sm font-semibold">
                              {Math.floor(totalWorkMinutes / 60)}h{totalWorkMinutes % 60}m
                            </div>
                          </div>
                          <div className="bg-muted/30 rounded-md p-2">
                            <div className="text-xs text-muted-foreground">出勤日数</div>
                            <div className="text-sm font-semibold">{workDays}日</div>
                          </div>
                          <div className="bg-muted/30 rounded-md p-2">
                            <div className="text-xs text-muted-foreground">推定給与</div>
                            <div className="text-sm font-semibold">
                              {currentHourlyRate > 0 ? `¥${estimatedSalary.toLocaleString()}` : "時給未設定"}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* セッション一覧 */}
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
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
                              className="flex items-center justify-between text-xs bg-muted/20 rounded-md px-2.5 py-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium">{dateLabel}</span>
                                <span className="text-muted-foreground">{timeLabel}</span>
                              </div>
                              <div className="flex items-center gap-2">
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
                  </div>
                )}
              </div>

              <div className="surface-card p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground">申請一覧</h3>
                </div>
                {userRequests.length === 0 ? (
                  <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                    申請データがありません。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userRequests.map((req) => {
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
                      return (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => setSelectedRequest(req)}
                          className="w-full rounded-[var(--ds-radius-md)] border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted/30 group"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
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
                              style={{ width: 24, height: 24 }}
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
