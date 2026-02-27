"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Square,
  Coffee,
  Clock,
  Calendar,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Users,
  Pause,
  ChevronDown,
  Save,
} from "lucide-react";
import { SelectField } from "@/components/select-field";
import { ShiftRequestModalFrame } from "@/components/shift-request-modal-frame";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AttendancePeriod,
  formatDurationMinutes,
  getCurrentClosingPeriod,
  isClosingWarningDay,
  parseTaskLines,
  formatTaskLines,
} from "@/lib/attendance";
import {
  AttendanceSessionDb,
  AttendanceStatusDb,
  breakEnd,
  breakStart,
  clockIn,
  clockOut,
  correctAttendance,
  getAttendanceSessions,
  getAttendanceStatus,
  getBreakMinutesDb,
  getWorkMinutesDb,
  saveCurrentTasks as saveCurrentTasksDb,
  saveSessionTasks as saveSessionTasksDb,
} from "@/lib/attendance-db";
import { supabase } from "@/lib/supabase/client";
import { formatJstDateLabel, formatJstDateTime, formatJstTime, formatJstTimeWithSeconds } from "@/lib/datetime";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type PeriodOption = {
  key: string;
  period: AttendancePeriod;
  label: string;
};

function toJstLocalInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

function fromJstLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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

function statusLabel(status: AttendanceStatusDb): string {
  if (status === "working") return "勤務中";
  if (status === "on_break") return "休憩中";
  return "未出勤";
}

/** 現在時刻をJSTでHH:MM:SS形式で取得 */
function formatCurrentTimeJst(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

/** 現在時刻をJSTで日付形式で取得 */
function formatCurrentDateJst(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

/** 経過時間をHH:MM:SS形式でフォーマット */
function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/** セッションの実働時間（秒）を計算 - リアルタイム用 */
function calculateWorkingSeconds(session: AttendanceSessionDb, now: Date): number {
  const startTime = new Date(session.start_at).getTime();
  const endTime = session.end_at ? new Date(session.end_at).getTime() : now.getTime();
  
  // 休憩時間を計算
  let breakMs = 0;
  for (const brk of session.breaks) {
    const breakStart = new Date(brk.start_at).getTime();
    const breakEnd = brk.end_at ? new Date(brk.end_at).getTime() : now.getTime();
    breakMs += breakEnd - breakStart;
  }
  
  const workingMs = endTime - startTime - breakMs;
  return Math.max(0, Math.floor(workingMs / 1000));
}

/** タイムラインイベントの型 */
type TimelineEvent = {
  id: string;
  type: "work_start" | "break_start" | "break_end" | "work_end";
  time: Date;
  label: string;
};

/** セッションからタイムラインイベントを生成 */
function buildTimelineEvents(session: AttendanceSessionDb): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  
  events.push({
    id: `start-${session.id}`,
    type: "work_start",
    time: new Date(session.start_at),
    label: "出勤",
  });

  for (const brk of session.breaks) {
    events.push({
      id: `break-start-${brk.id}`,
      type: "break_start",
      time: new Date(brk.start_at),
      label: "休憩開始",
    });
    if (brk.end_at) {
      events.push({
        id: `break-end-${brk.id}`,
        type: "break_end",
        time: new Date(brk.end_at),
        label: "休憩終了",
      });
    }
  }

  if (session.end_at) {
    events.push({
      id: `end-${session.id}`,
      type: "work_end",
      time: new Date(session.end_at),
      label: "退勤",
    });
  }

  return events.sort((a, b) => a.time.getTime() - b.time.getTime());
}

/** 期間内のセッションか判定 */
function isSessionInPeriodDb(session: AttendanceSessionDb, period: AttendancePeriod): boolean {
  const sessionStart = new Date(session.start_at).getTime();
  const periodStart = new Date(period.startAt).getTime();
  const periodEnd = new Date(period.endAt).getTime();
  return sessionStart >= periodStart && sessionStart < periodEnd;
}

/** 異常検出 */
interface AttendanceAnomaly {
  id: string;
  type: "open_shift" | "open_break" | "closing_split";
  sessionId: string;
  userId: string;
  message: string;
}

function findAnomaliesDb(sessions: AttendanceSessionDb[]): AttendanceAnomaly[] {
  const anomalies: AttendanceAnomaly[] = [];
  for (const session of sessions) {
    if (session.end_at === null) {
      anomalies.push({
        id: `open-${session.id}`,
        type: "open_shift",
        sessionId: session.id,
        userId: session.user_id,
        message: "退勤していないセッションがあります",
      });
    }
    for (const brk of session.breaks) {
      if (brk.end_at === null) {
        anomalies.push({
          id: `break-${brk.id}`,
          type: "open_break",
          sessionId: session.id,
          userId: session.user_id,
          message: "休憩が終了していません",
        });
      }
    }
    if (session.split_by_closing_boundary) {
      anomalies.push({
        id: `split-${session.id}`,
        type: "closing_split",
        sessionId: session.id,
        userId: session.user_id,
        message: "20日締めで自動分割されました",
      });
    }
  }
  return anomalies;
}

function AttendanceScreen() {
  const currentUser = useAppStore((state) => state.currentUser);
  const users = useAppStore((state) => state.users);
  const fetchUsers = useAppStore((state) => state.fetchUsers);
  const activeTab = useAppStore((state) => state.activeAttendanceTab);

  const [sessions, setSessions] = useState<AttendanceSessionDb[]>([]);
  const [myStatus, setMyStatus] = useState<AttendanceStatusDb>("off");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const periodOptions = useMemo(() => buildPeriodOptions(), []);
  const [periodKey, setPeriodKey] = useState(periodOptions[0]?.key ?? "");

  const [homeTaskDraft, setHomeTaskDraft] = useState("");
  const [taskSaveStatus, setTaskSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [taskDraftBySessionId, setTaskDraftBySessionId] = useState<Record<string, string>>({});

  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [manageFilterUserId, setManageFilterUserId] = useState("all");
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);

  // 現在時刻を1秒ごとに更新
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const currentPeriod = useMemo(
    () => periodOptions.find((item) => item.key === periodKey)?.period ?? periodOptions[0]?.period ?? getCurrentClosingPeriod(),
    [periodOptions, periodKey]
  );

  // DBからデータ取得
  const refreshData = useCallback(async () => {
    if (!currentUser) return;

    try {
      // 状態を取得
      const status = await getAttendanceStatus();
      setMyStatus(status);

      // セッション一覧を取得（期間でフィルタ）
      const startDate = currentPeriod.startAt.split("T")[0];
      const endDate = currentPeriod.endAt.split("T")[0];
      const result = await getAttendanceSessions({
        startDate,
        endDate,
      });

      if (result.ok && result.data) {
        setSessions(result.data);
      }
    } catch (err) {
      console.error("Failed to refresh attendance data:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, currentPeriod]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  // Supabase Realtimeで勤怠データをリアルタイム同期
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel("attendance-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_sessions",
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          // 自分のセッションが変更されたらデータを再取得
          void refreshData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_breaks",
        },
        () => {
          // 休憩データが変更されたらデータを再取得
          void refreshData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUser, refreshData]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== "staff") {
      void fetchUsers({ force: true });
    }
  }, [currentUser, fetchUsers]);

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    if (currentUser) map.set(currentUser.id, currentUser.name);
    for (const user of users) map.set(user.id, user.name);
    return map;
  }, [currentUser, users]);

  const myOpenSession = useMemo(() => {
    if (!currentUser) return null;
    return sessions.find((s) => s.user_id === currentUser.id && s.end_at === null) ?? null;
  }, [sessions, currentUser]);

  useEffect(() => {
    setHomeTaskDraft(myOpenSession ? formatTaskLines(myOpenSession.tasks) : "");
  }, [myOpenSession?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser) return null;

  const role = currentUser.role;
  const canCorrect = role === "reviewer" || role === "admin";
  const isClosingDay = isClosingWarningDay();

  const myPeriodSessions = sessions.filter((session) => {
    if (session.user_id !== currentUser.id) return false;
    return isSessionInPeriodDb(session, currentPeriod);
  });

  const managedSessions = sessions.filter((session) => {
    if (!isSessionInPeriodDb(session, currentPeriod)) return false;
    if (manageFilterUserId !== "all" && session.user_id !== manageFilterUserId) return false;
    return true;
  });

  const anomalies = findAnomaliesDb(sessions).filter((item) => {
    const session = sessions.find((entry) => entry.id === item.sessionId);
    if (!session) return false;
    if (!isSessionInPeriodDb(session, currentPeriod)) return false;
    if (manageFilterUserId !== "all" && session.user_id !== manageFilterUserId) return false;
    return true;
  });

  const editSession = editSessionId ? sessions.find((session) => session.id === editSessionId) ?? null : null;

  const handleClockIn = async () => {
    setError("");
    const result = await clockIn();
    if (!result.ok) {
      setError(result.error ?? "出勤に失敗しました");
      return;
    }
    setNotice("出勤しました");
    await refreshData();
  };

  const handleBreakStart = async () => {
    setError("");
    const result = await breakStart();
    if (!result.ok) {
      setError(result.error ?? "休憩開始に失敗しました");
      return;
    }
    setNotice("休憩を開始しました");
    await refreshData();
  };

  const handleBreakEnd = async () => {
    setError("");
    const result = await breakEnd();
    if (!result.ok) {
      setError(result.error ?? "休憩終了に失敗しました");
      return;
    }
    setNotice("休憩を終了しました");
    await refreshData();
  };

  const handleClockOut = async () => {
    setError("");
    const tasks = parseTaskLines(homeTaskDraft);
    const result = await clockOut(tasks);
    if (!result.ok) {
      setError(result.error ?? "退勤に失敗しました");
      return;
    }
    setNotice("退勤しました");
    await refreshData();
  };

  const handleSaveCurrentTasks = async () => {
    setError("");
    const tasks = parseTaskLines(homeTaskDraft);
    const result = await saveCurrentTasksDb(tasks);
    if (!result.ok) {
      setError(result.error ?? "保存に失敗しました");
      return;
    }
    setNotice("やったことを保存しました");
    await refreshData();
  };

  const handleSaveSessionTasks = async (session: AttendanceSessionDb) => {
    setError("");
    const draft = taskDraftBySessionId[session.id] ?? formatTaskLines(session.tasks);
    const tasks = parseTaskLines(draft);

    // 自分のオープンセッションなら saveCurrentTasks、それ以外は saveSessionTasks
    if (session.end_at === null && session.user_id === currentUser.id) {
      const result = await saveCurrentTasksDb(tasks);
      if (!result.ok) {
        setError(result.error ?? "保存に失敗しました");
        return;
      }
    } else {
      const result = await saveSessionTasksDb(session.id, tasks);
      if (!result.ok) {
        setError(result.error ?? "保存に失敗しました");
        return;
      }
    }
    setNotice("やったことを保存しました");
    await refreshData();
  };

  const openCorrection = (session: AttendanceSessionDb) => {
    setEditSessionId(session.id);
    setEditStartAt(toJstLocalInput(session.start_at));
    setEditEndAt(session.end_at ? toJstLocalInput(session.end_at) : "");
    setEditMessage("");
  };

  const handleSaveCorrection = async () => {
    if (!editSession) return;
    const startAtIso = fromJstLocalInput(editStartAt);
    const endAtIso = editEndAt ? fromJstLocalInput(editEndAt) : null;
    if (!startAtIso) {
      setError("開始時刻の形式が不正です");
      return;
    }
    if (editEndAt && !endAtIso) {
      setError("終了時刻の形式が不正です");
      return;
    }
    if (!editMessage.trim()) {
      setError("修正メッセージを入力してください");
      return;
    }

    const result = await correctAttendance(editSession.id, startAtIso, endAtIso, editMessage);
    if (!result.ok) {
      setError(result.error ?? "修正に失敗しました");
      return;
    }
    setEditSessionId(null);
    setEditMessage("");
    setNotice("勤怠を修正しました");
    await refreshData();
  };

  const userFilterOptions = [
    { value: "all", label: "全員" },
    ...users.filter((user) => user.role === "staff").map((user) => ({
      value: user.id,
      label: user.name,
    })),
  ];

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="page-title">勤怠</h1>
      </div>

      {(notice || error) && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-xs font-medium",
            error ? "border-[var(--status-rejected)] text-[var(--status-rejected)]" : "border-[var(--outline-variant)] text-[var(--primary)]"
          )}
        >
          {error || notice}
        </div>
      )}

      {activeTab === "home" && role === "staff" && (
        <div className="space-y-4">
          {/* 現在時刻ヒーロー */}
          <div className="rounded-2xl bg-[var(--primary-container)] p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[var(--primary)]">{formatCurrentDateJst(currentTime)}</p>
                <p className="text-5xl font-bold tracking-tight mt-1 tabular-nums text-[var(--primary)]">
                  {formatCurrentTimeJst(currentTime)}
                </p>
              </div>
              {myStatus !== "off" && myOpenSession && (
                <div className="text-right">
                  <p className="text-xs text-[var(--primary)]/70">実働時間</p>
                  <p className="text-2xl font-bold tabular-nums mt-0.5 text-[var(--primary)]">
                    {formatElapsedTime(calculateWorkingSeconds(myOpenSession, currentTime))}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ステータスカード */}
          <div
            className={cn(
              "rounded-xl px-4 py-3",
              myStatus === "working" && "bg-[var(--status-approved)]/10 border border-[var(--status-approved)]/20",
              myStatus === "on_break" && "bg-[var(--primary)]/10 border border-[var(--primary)]/20",
              myStatus === "off" && "bg-[var(--surface-container)]"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    myStatus === "working" && "bg-[var(--status-approved)]/20",
                    myStatus === "on_break" && "bg-[var(--primary)]/20",
                    myStatus === "off" && "bg-[var(--surface-container-high)]"
                  )}
                >
                  {myStatus === "working" && <Play className="h-4 w-4 text-[var(--status-approved)]" />}
                  {myStatus === "on_break" && <Pause className="h-4 w-4 text-[var(--primary)]" />}
                  {myStatus === "off" && <Clock className="h-4 w-4 text-[var(--on-surface-variant)]" />}
                </div>
                <div>
                  <p className="text-[10px] text-[var(--on-surface-variant)]">ステータス</p>
                  <p className="text-sm font-bold text-foreground">{statusLabel(myStatus)}</p>
                </div>
              </div>
              {myStatus !== "off" && myOpenSession && (
                <div className="text-right pr-1">
                  <p className="text-[10px] text-[var(--on-surface-variant)]">出勤</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">{formatJstTimeWithSeconds(myOpenSession.start_at)}</p>
                </div>
              )}
            </div>

            {isClosingDay && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-[var(--status-pending)]/10 px-2.5 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-[var(--status-pending)] shrink-0" />
                <span className="text-[11px] text-[var(--status-pending)]">
                  締め日のため日跨ぎ勤務不可
                </span>
              </div>
            )}
          </div>

          {/* アクションボタン - 状態に応じて必要なものだけ表示 */}
          <div className={cn(
            "grid gap-2",
            myStatus === "off" ? "grid-cols-1" : "grid-cols-2"
          )}>
            {/* 未出勤 → 出勤ボタンのみ */}
            {myStatus === "off" && (
              <button
                type="button"
                onClick={handleClockIn}
                className="group flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-3 px-4 text-[var(--primary-foreground)] transition-all hover:bg-[var(--primary)]/90 active:scale-[0.98]"
              >
                <Play className="h-5 w-5" />
                <span className="text-sm font-semibold">出勤する</span>
              </button>
            )}

            {/* 勤務中 → 休憩・退勤 */}
            {myStatus === "working" && (
              <>
                <button
                  type="button"
                  onClick={handleBreakStart}
                  className="group flex items-center justify-center gap-2 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 py-3 px-4 text-foreground transition-all hover:bg-[var(--primary)]/15 active:scale-[0.98]"
                >
                  <Coffee className="h-5 w-5 text-[var(--primary)]" />
                  <span className="text-sm font-semibold">休憩</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowClockOutConfirm(true)}
                  className="group flex items-center justify-center gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] py-3 px-4 text-foreground transition-all hover:bg-[var(--surface-container-high)] active:scale-[0.98]"
                >
                  <Square className="h-5 w-5" />
                  <span className="text-sm font-semibold">退勤</span>
                </button>
              </>
            )}

            {/* 休憩中 → 休憩終了のみ */}
            {myStatus === "on_break" && (
              <button
                type="button"
                onClick={handleBreakEnd}
                className="group col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-3 px-4 text-[var(--primary-foreground)] transition-all hover:bg-[var(--primary)]/90 active:scale-[0.98]"
              >
                <Play className="h-5 w-5" />
                <span className="text-sm font-semibold">休憩終了</span>
              </button>
            )}
          </div>

          {/* タスク入力 */}
          {myStatus !== "off" && (
            <div className="rounded-2xl bg-[var(--surface-container)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-foreground">やったこと</span>
                {taskSaveStatus === "saving" && (
                  <span className="text-xs text-[var(--primary)] animate-pulse">保存中...</span>
                )}
                {taskSaveStatus === "saved" && (
                  <span className="text-xs text-[var(--status-approved)]">✓</span>
                )}
              </div>
              
              {/* 入力済みタスクをチップで表示 */}
              {homeTaskDraft && parseTaskLines(homeTaskDraft).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {parseTaskLines(homeTaskDraft).map((task, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/10 px-3 py-1.5 text-sm text-foreground"
                    >
                      {task}
                      <button
                        type="button"
                        onClick={() => {
                          const tasks = parseTaskLines(homeTaskDraft);
                          tasks.splice(idx, 1);
                          const newValue = formatTaskLines(tasks);
                          setHomeTaskDraft(newValue);
                          setTaskSaveStatus("saving");
                          saveCurrentTasksDb(tasks).then((result) => {
                            if (result.ok) {
                              setTaskSaveStatus("saved");
                              setTimeout(() => setTaskSaveStatus("idle"), 3000);
                            } else {
                              setError(result.error ?? "保存に失敗しました");
                              setTaskSaveStatus("idle");
                            }
                          });
                        }}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--primary)]/20 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5 text-[var(--on-surface-variant)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {/* 1行入力 */}
              <input
                type="text"
                placeholder="タスクを入力してEnter"
                className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2.5 text-sm text-foreground placeholder:text-[var(--on-surface-variant)]/50 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    e.preventDefault();
                    const newTask = e.currentTarget.value.trim();
                    const tasks = parseTaskLines(homeTaskDraft);
                    tasks.push(newTask);
                    const newValue = formatTaskLines(tasks);
                    setHomeTaskDraft(newValue);
                    e.currentTarget.value = "";
                    
                    // 即保存
                    setTaskSaveStatus("saving");
                    saveCurrentTasksDb(tasks).then((result) => {
                      if (result.ok) {
                        setTaskSaveStatus("saved");
                        setTimeout(() => setTaskSaveStatus("idle"), 3000);
                      } else {
                        setError(result.error ?? "保存に失敗しました");
                        setTaskSaveStatus("idle");
                      }
                    });
                  }
                }}
              />
            </div>
          )}

          {/* タイムライン（勤務中のみ表示・アコーディオン） */}
          {myStatus !== "off" && myOpenSession && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl bg-[var(--surface-container)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-container-high)] group">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-sm font-medium text-foreground">タイムライン</span>
                  <span className="text-xs text-[var(--on-surface-variant)]">
                    ({buildTimelineEvents(myOpenSession).length}件)
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-[var(--on-surface-variant)] transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-xl bg-[var(--surface-container)] px-4 py-3">
                  <div className="relative pl-4">
                    {/* タイムライン縦線 */}
                    <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-[var(--outline-variant)]" />
                    
                    <div className="space-y-2.5">
                      {buildTimelineEvents(myOpenSession).map((event) => (
                        <div key={event.id} className="relative flex items-center gap-3">
                          {/* ドット */}
                          <div
                            className={cn(
                              "absolute -left-4 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-[var(--surface-container)]",
                              event.type === "work_start" && "border-[var(--status-approved)]",
                              event.type === "work_end" && "border-[var(--on-surface-variant)]",
                              event.type === "break_start" && "border-[var(--primary)]",
                              event.type === "break_end" && "border-[var(--primary)]"
                            )}
                          >
                            <div
                              className={cn(
                                "h-2 w-2 rounded-full",
                                event.type === "work_start" && "bg-[var(--status-approved)]",
                                event.type === "work_end" && "bg-[var(--on-surface-variant)]",
                                event.type === "break_start" && "bg-[var(--primary)]",
                                event.type === "break_end" && "bg-[var(--primary)]"
                              )}
                            />
                          </div>
                          {/* 時刻とラベル */}
                          <div className="flex flex-1 items-center justify-between">
                            <span className="text-sm text-foreground">{event.label}</span>
                            <span className="text-sm font-medium tabular-nums text-[var(--on-surface-variant)]">
                              {formatJstTimeWithSeconds(event.time.toISOString())}
                            </span>
                          </div>
                        </div>
                      ))}
                      
                      {/* 現在進行中インジケーター（点滅はここだけ） */}
                      {!myOpenSession.end_at && (
                        <div className="relative flex items-center gap-3">
                          <div className="absolute -left-4 flex h-4 w-4 items-center justify-center bg-[var(--surface-container)]">
                            <div className={cn(
                              "h-3 w-3 rounded-full animate-pulse",
                              myStatus === "working" ? "bg-[var(--status-approved)]" : "bg-[var(--primary)]"
                            )} />
                          </div>
                          <div className="flex flex-1 items-center justify-between">
                            <span className={cn(
                              "text-sm font-medium",
                              myStatus === "working" ? "text-[var(--status-approved)]" : "text-[var(--primary)]"
                            )}>
                              {myStatus === "working" ? "勤務中..." : "休憩中..."}
                            </span>
                            <span className="text-sm font-medium tabular-nums text-foreground">
                              {formatCurrentTimeJst(currentTime)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {activeTab === "list" && (
        <div className="space-y-4">
          {/* 期間選択 */}
          <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface-container)] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10">
              <Calendar className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div className="flex-1">
              <SelectField
                label="対象期間"
                value={periodKey}
                onChange={setPeriodKey}
                options={periodOptions.map((option) => ({
                  value: option.key,
                  label: option.label,
                }))}
              />
            </div>
          </div>

          {/* セッション一覧 */}
          <div className="space-y-3">
            {(role === "staff" ? myPeriodSessions : managedSessions).length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--surface-container)] py-12 px-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-container-high)]">
                  <Calendar className="h-8 w-8 text-[var(--on-surface-variant)]" />
                </div>
                <p className="mt-4 text-sm font-medium text-[var(--on-surface-variant)]">勤務データがありません</p>
              </div>
            )}

            {(role === "staff" ? myPeriodSessions : managedSessions).map((session) => {
              const breakMinutes = getBreakMinutesDb(session);
              const workMinutes = getWorkMinutesDb(session);
              const ownerName = nameByUserId.get(session.user_id) ?? "不明";
              const draft = taskDraftBySessionId[session.id] ?? formatTaskLines(session.tasks);
              const isOpen = session.end_at === null;

              return (
                <div key={session.id} className="rounded-2xl bg-[var(--surface-container)] p-4 space-y-4">
                  {/* ヘッダー */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
                        isOpen ? "bg-[var(--status-approved)]/15" : "bg-[var(--surface-container-high)]"
                      )}>
                        {isOpen ? (
                          <Play className="h-5 w-5 text-[var(--status-approved)]" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-[var(--on-surface-variant)]" />
                        )}
                      </div>
                      <div>
                        {role !== "staff" && (
                          <p className="text-xs text-[var(--on-surface-variant)] mb-0.5">{ownerName}</p>
                        )}
                        <p className="text-sm font-semibold text-foreground">
                          {formatJstDateLabel(session.start_at)}
                        </p>
                        <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                          {formatJstTimeWithSeconds(session.start_at)} 〜 {session.end_at ? formatJstTimeWithSeconds(session.end_at) : "勤務中"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.split_by_closing_boundary && (
                        <span className="rounded-full bg-[var(--status-pending)]/15 px-2.5 py-1 text-[10px] font-semibold text-[var(--status-pending)]">
                          分割
                        </span>
                      )}
                      {isOpen && (
                        <span className="rounded-full bg-[var(--status-approved)]/15 px-2.5 py-1 text-[10px] font-semibold text-[var(--status-approved)]">
                          勤務中
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 統計 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-container-high)] px-3 py-2">
                      <Coffee className="h-4 w-4 text-[var(--on-surface-variant)]" />
                      <div className="text-xs">
                        <span className="text-[var(--on-surface-variant)]">休憩</span>
                        <span className="ml-1 font-semibold text-foreground">{formatDurationMinutes(breakMinutes)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-container-high)] px-3 py-2">
                      <Timer className="h-4 w-4 text-[var(--on-surface-variant)]" />
                      <div className="text-xs">
                        <span className="text-[var(--on-surface-variant)]">実働</span>
                        <span className="ml-1 font-semibold text-foreground">{formatDurationMinutes(workMinutes)}</span>
                      </div>
                    </div>
                  </div>

                  {/* タスク */}
                  {role === "staff" && session.user_id === currentUser.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={draft}
                        onChange={(event) => {
                          setTaskDraftBySessionId((prev) => ({ ...prev, [session.id]: event.target.value }));
                        }}
                        className="input-base min-h-[80px] resize-y text-sm"
                        aria-label="やったこと"
                        placeholder="やったことを入力"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveSessionTasks(session)}
                        className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-container-highest)] py-2.5 px-4 text-xs font-semibold text-foreground transition-colors hover:bg-[var(--outline-variant)]"
                      >
                        <Save className="h-3.5 w-3.5" />
                        保存
                      </button>
                    </div>
                  ) : session.tasks.length > 0 && (
                    <div className="rounded-xl bg-[var(--surface-container-high)] px-3 py-2.5">
                      <ul className="space-y-1 text-xs text-foreground">
                        {session.tasks.map((item, index) => (
                          <li key={`${session.id}-task-${index}`} className="flex items-start gap-2">
                            <span className="text-[var(--on-surface-variant)]">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 修正ボタン */}
                  {canCorrect && (
                    <button
                      type="button"
                      onClick={() => openCorrection(session)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--outline-variant)] py-2.5 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      勤怠を修正
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "manage" && canCorrect && (
        <div className="space-y-4">
          {/* フィルター */}
          <div className="rounded-2xl bg-[var(--surface-container)] p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-[var(--primary)]" />
              <span className="text-sm font-medium text-foreground">フィルター</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField label="対象期間" value={periodKey} onChange={setPeriodKey} options={periodOptions.map((item) => ({ value: item.key, label: item.label }))} />
              <SelectField label="対象者" value={manageFilterUserId} onChange={setManageFilterUserId} options={userFilterOptions} />
            </div>
          </div>

          {/* 異常一覧 */}
          <div className="rounded-2xl bg-[var(--surface-container)] p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                anomalies.length > 0 ? "bg-[var(--status-rejected)]/15" : "bg-[var(--status-approved)]/15"
              )}>
                <AlertTriangle className={cn(
                  "h-4 w-4",
                  anomalies.length > 0 ? "text-[var(--status-rejected)]" : "text-[var(--status-approved)]"
                )} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">異常検出</p>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {anomalies.length === 0 ? "問題なし" : `${anomalies.length}件の問題`}
                </p>
              </div>
            </div>

            {anomalies.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-[var(--status-approved)]/10 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-[var(--status-approved)]" />
                <span className="text-sm text-[var(--status-approved)]">すべて正常です</span>
              </div>
            ) : (
              <div className="space-y-2">
                {anomalies.map((item) => {
                  const session = sessions.find((entry) => entry.id === item.sessionId);
                  if (!session) return null;
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-xl bg-[var(--status-rejected)]/5 border border-[var(--status-rejected)]/20 px-4 py-3"
                    >
                      <AlertTriangle className="h-4 w-4 text-[var(--status-rejected)] shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.message}</p>
                        <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                          {nameByUserId.get(item.userId) ?? "不明"} • {formatJstDateTime(session.start_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCorrection(session)}
                        className="shrink-0 text-xs font-medium text-[var(--primary)] hover:underline"
                      >
                        修正
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {editSession && (
        <ShiftRequestModalFrame
          onClose={() => setEditSessionId(null)}
          header={<p className="text-sm font-semibold text-foreground">勤怠を修正</p>}
          bodyClassName="px-5 py-5"
          maxWidthClassName="max-w-md"
          footer={
            <button type="button" onClick={handleSaveCorrection} className="button-primary w-full">
              修正を保存
            </button>
          }
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">開始時刻</label>
              <input type="datetime-local" value={editStartAt} onChange={(event) => setEditStartAt(event.target.value)} className="input-base" aria-label="開始時刻" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">終了時刻（任意）</label>
              <input type="datetime-local" value={editEndAt} onChange={(event) => setEditEndAt(event.target.value)} className="input-base" aria-label="終了時刻" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">修正メッセージ（必須）</label>
              <textarea value={editMessage} onChange={(event) => setEditMessage(event.target.value)} rows={4} className="input-base min-h-[96px] resize-y" aria-label="修正メッセージ" placeholder="修正理由を入力" />
            </div>
          </div>
        </ShiftRequestModalFrame>
      )}

      {/* 退勤確認モーダル */}
      {showClockOutConfirm && (
        <ShiftRequestModalFrame
          header={<span className="text-base font-semibold">退勤確認</span>}
          onClose={() => setShowClockOutConfirm(false)}
          footer={
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={async () => {
                  const tasks = parseTaskLines(homeTaskDraft);
                  if (tasks.length === 0) {
                    setError("「やったこと」を1件以上入力してください");
                    return;
                  }
                  await handleClockOut();
                  setShowClockOutConfirm(false);
                }}
                disabled={parseTaskLines(homeTaskDraft).length === 0}
                className={cn(
                  "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all",
                  parseTaskLines(homeTaskDraft).length === 0
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-[var(--status-rejected)] text-white hover:bg-[var(--status-rejected)]/90"
                )}
              >
                退勤する
              </button>
            </div>
          }
        >
          <div className="space-y-4 px-5 py-4">
            <p className="text-sm text-[var(--on-surface-variant)]">
              退勤してよろしいですか？
            </p>

            {/* やったこと一覧 */}
            <div className="rounded-xl bg-[var(--surface-container)] p-4">
              <p className="text-xs font-medium text-[var(--on-surface-variant)] mb-2">やったこと</p>
              {parseTaskLines(homeTaskDraft).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {parseTaskLines(homeTaskDraft).map((task, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-full bg-[var(--primary)]/10 px-3 py-1 text-sm text-foreground"
                    >
                      {task}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[var(--status-rejected)]">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">「やったこと」を入力してください</span>
                </div>
              )}
            </div>

            {myOpenSession && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-[var(--surface-container)] p-3">
                  <p className="text-xs text-[var(--on-surface-variant)]">出勤時刻</p>
                  <p className="font-semibold tabular-nums">{formatJstTimeWithSeconds(myOpenSession.start_at)}</p>
                </div>
                <div className="rounded-lg bg-[var(--surface-container)] p-3">
                  <p className="text-xs text-[var(--on-surface-variant)]">実働時間</p>
                  <p className="font-semibold tabular-nums">{formatElapsedTime(calculateWorkingSeconds(myOpenSession, currentTime))}</p>
                </div>
              </div>
            )}
          </div>
        </ShiftRequestModalFrame>
      )}
    </div>
  );
}

export default function Page() {
  return <AttendanceScreen />;
}
