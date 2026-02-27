"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  LogOut,
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
  AttendanceBreakDb,
  AttendanceCorrectionDb,
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
  handleDayChange,
  saveCurrentTasks as saveCurrentTasksDb,
} from "@/lib/attendance-db";
import { supabase } from "@/lib/supabase/client";
import { formatJstDateLabel, formatJstDateTime, formatJstTime, formatJstTimeWithSeconds, getISOWeekNumber, formatYmd } from "@/lib/datetime";
import { useAppStore } from "@/lib/store";
import type { FixRequest, FlexRequest, HourlyRate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getApplicableHourlyRate, getHourlyRates } from "@/lib/hourly-rate";

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
  const requests = useAppStore((state) => state.requests);
  const fetchRequests = useAppStore((state) => state.fetchRequests);
  const activeTab = useAppStore((state) => state.activeAttendanceTab);

  const [sessions, setSessions] = useState<AttendanceSessionDb[]>([]);
  const [myStatus, setMyStatus] = useState<AttendanceStatusDb>("off");
  const [currentTime, setCurrentTime] = useState(new Date());

  const periodOptions = useMemo(() => buildPeriodOptions(), []);
  const [periodKey, setPeriodKey] = useState(periodOptions[0]?.key ?? "");

  const [homeTaskDraft, setHomeTaskDraft] = useState("");
  const [taskSaveStatus, setTaskSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const lastSyncedTasksRef = useRef<string>(""); // Realtime同期用: 前回同期したタスクのJSON
  const [taskInputValue, setTaskInputValue] = useState(""); // タスク入力欄の値

  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [manageFilterUserId, setManageFilterUserId] = useState("all");
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  // 出勤警告タイプ: null=なし, no-shift=シフトなし, early=早すぎ, late=遅すぎ, overtime=130%超過
  const [clockInWarningType, setClockInWarningType] = useState<null | "no-shift" | "early" | "late" | "overtime">(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [modalTaskInput, setModalTaskInput] = useState("");
  const [hourlyRates, setHourlyRates] = useState<HourlyRate[]>([]);

  // 現在ユーザーの時給を取得
  useEffect(() => {
    if (currentUser?.id) {
      void getHourlyRates(currentUser.id).then((result) => {
        if (result.ok) setHourlyRates(result.data);
      });
    }
  }, [currentUser?.id]);

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
    }
  }, [currentUser, currentPeriod]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  // Supabase Realtimeで勤怠データ��リアルタイム同期
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
        async (payload) => {
          // ステータスを即座に更新
          const status = await getAttendanceStatus();
          setMyStatus(status);

          // セッションデータを差分更新
          if (payload.eventType === "INSERT") {
            const newSession = payload.new as AttendanceSessionDb & { breaks?: AttendanceBreakDb[]; corrections?: AttendanceCorrectionDb[] };
            setSessions((prev) => [
              ...prev,
              { ...newSession, breaks: newSession.breaks ?? [], corrections: newSession.corrections ?? [] },
            ]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Partial<AttendanceSessionDb>;
            setSessions((prev) =>
              prev.map((s) =>
                s.id === updated.id
                  ? { ...s, ...updated }
                  : s
              )
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setSessions((prev) => prev.filter((s) => s.id !== deleted.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_breaks",
        },
        async (payload) => {
          // ステータスを即座に更新
          const status = await getAttendanceStatus();
          setMyStatus(status);

          // 休憩データを該当セッションに差分反映
          if (payload.eventType === "INSERT") {
            const newBreak = payload.new as AttendanceBreakDb & { session_id: string };
            setSessions((prev) =>
              prev.map((s) =>
                s.id === newBreak.session_id
                  ? { ...s, breaks: [...s.breaks, { id: newBreak.id, start_at: newBreak.start_at, end_at: newBreak.end_at }] }
                  : s
              )
            );
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as AttendanceBreakDb & { session_id: string };
            setSessions((prev) =>
              prev.map((s) =>
                s.id === updated.session_id
                  ? {
                    ...s,
                    breaks: s.breaks.map((b) =>
                      b.id === updated.id ? { id: updated.id, start_at: updated.start_at, end_at: updated.end_at } : b
                    ),
                  }
                  : s
              )
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string; session_id: string };
            setSessions((prev) =>
              prev.map((s) =>
                s.id === deleted.session_id
                  ? { ...s, breaks: s.breaks.filter((b) => b.id !== deleted.id) }
                  : s
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== "staff") {
      void fetchUsers({ force: true });
    }
  }, [currentUser, fetchUsers]);

  // シフト申請データを取得（staffのみ、シフト予定表示用）
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === "staff") {
      void fetchRequests();
    }
  }, [currentUser, fetchRequests]);

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

  // Realtime同期: 他デバイスからのタスク変更を検知して反映
  useEffect(() => {
    if (!myOpenSession) {
      setHomeTaskDraft("");
      lastSyncedTasksRef.current = "";
      return;
    }

    const newTasksJson = JSON.stringify(myOpenSession.tasks);
    const localTasksJson = JSON.stringify(parseTaskLines(homeTaskDraft));

    // 初回、またはローカルが編集されていない場合（前回同期値と同じ）に更新
    if (lastSyncedTasksRef.current === "" || localTasksJson === lastSyncedTasksRef.current) {
      setHomeTaskDraft(formatTaskLines(myOpenSession.tasks));
      lastSyncedTasksRef.current = newTasksJson;
    }
  }, [myOpenSession?.id, JSON.stringify(myOpenSession?.tasks ?? [])]); // eslint-disable-line react-hooks/exhaustive-deps

  // handleClockInWithCheck で使う変数（フックなので早期リターンの前に配置）
  const todayStr = formatYmd(new Date());
  const userRequestType = currentUser?.requestType ?? "fix";
  const currentUserId = currentUser?.id;

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
    const result = await clockIn();
    if (!result.ok) {
      toast({ description: result.error ?? "出勤に失敗しました", variant: "destructive" });
      return;
    }
    setMyStatus("working"); // 即座にステータス更新
    setShowThankYou(false); // お疲れ様画面を消す
    setClockInWarningType(null); // 警告ダイアログを閉じる
    toast({ description: "出勤しました" });
    await refreshData();
  };

  const handleClockInWithCheck = () => {
    const now = new Date();

    if (userRequestType === "fix") {
      // fix勤務: 本日のシフトを取得
      const todayFixRequest = requests.find((r): r is FixRequest =>
        r.type === "fix" &&
        r.userId === currentUserId &&
        r.status === "approved" &&
        (r.approvedStartAt ?? r.requestedStartAt).startsWith(todayStr)
      );

      if (!todayFixRequest) {
        setClockInWarningType("no-shift");
        return;
      }

      // シフト開始・終了時刻
      const shiftStartAt = todayFixRequest.approvedStartAt ?? todayFixRequest.requestedStartAt;
      const shiftEndAt = todayFixRequest.approvedEndAt ?? todayFixRequest.requestedEndAt;
      const shiftStart = new Date(shiftStartAt);
      const shiftEnd = new Date(shiftEndAt);
      const oneHourBefore = new Date(shiftStart.getTime() - 60 * 60 * 1000);

      if (now < oneHourBefore) {
        setClockInWarningType("early");
        return;
      }
      if (now > shiftEnd) {
        setClockInWarningType("late");
        return;
      }

      // 今日の勤務時間を計算して130%超過チェック
      const shiftMinutes = Math.max(0, Math.floor((shiftEnd.getTime() - shiftStart.getTime()) / 60000));
      const todaySessions = sessions.filter((s) => {
        if (s.user_id !== currentUserId) return false;
        return s.start_at.startsWith(todayStr);
      });
      const workedMinutes = todaySessions.reduce((sum, s) => sum + getWorkMinutesDb(s), 0);
      const progressPercent = shiftMinutes > 0 ? Math.round((workedMinutes / shiftMinutes) * 100) : 0;

      if (progressPercent > 130) {
        setClockInWarningType("overtime");
        return;
      }

      // 問題なければ出勤
      handleClockIn();
    } else {
      // flex勤務: 今週のシフトを取得
      const { year, week } = getISOWeekNumber(todayStr);
      const thisWeekFlexRequest = requests.find((r): r is FlexRequest =>
        r.type === "flex" &&
        r.userId === currentUserId &&
        r.status === "approved" &&
        r.isoYear === year &&
        r.isoWeek === week
      );

      if (!thisWeekFlexRequest) {
        setClockInWarningType("no-shift");
        return;
      }

      // 週間勤務時間を計算して130%超過チェック
      const weekStartDate = thisWeekFlexRequest.weekStartDate ?? (() => {
        const d = new Date(todayStr + "T00:00:00");
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        return formatYmd(d, "Asia/Tokyo");
      })();
      const weekEndDate = (() => {
        const d = new Date(weekStartDate + "T00:00:00");
        d.setDate(d.getDate() + 6);
        return formatYmd(d, "Asia/Tokyo");
      })();
      const thisWeekSessions = sessions.filter((s) => {
        if (s.user_id !== currentUserId) return false;
        const sessionDate = s.start_at.split("T")[0];
        return sessionDate >= weekStartDate && sessionDate <= weekEndDate;
      });
      const workedMinutes = thisWeekSessions.reduce((sum, s) => sum + getWorkMinutesDb(s), 0);
      const approvedMinutes = (thisWeekFlexRequest.approvedHours ?? 0) * 60;
      const progressPercent = approvedMinutes > 0 ? Math.round((workedMinutes / approvedMinutes) * 100) : 0;

      if (progressPercent > 130) {
        setClockInWarningType("overtime");
        return;
      }

      // 問題なければ出勤
      handleClockIn();
    }
  };

  const handleBreakStart = async () => {
    // 日跨ぎチェック: セッション開始日と今日が異なれば自動退勤・出勤
    const dayChangeResult = await handleDayChange();
    if (!dayChangeResult.ok) {
      toast({ description: dayChangeResult.error ?? "日跨ぎ処理に失敗しました", variant: "destructive" });
      return;
    }
    if (dayChangeResult.data) {
      // 日跨ぎがあった場合、データを更新
      await refreshData();
      toast({ description: "日付が変わったため、自動で退勤・出勤しました" });
    }

    const result = await breakStart();
    if (!result.ok) {
      toast({ description: result.error ?? "休憩開始に失敗しました", variant: "destructive" });
      return;
    }
    setMyStatus("on_break"); // 即座にステータス更新
    toast({ description: "休憩を開始しました" });
    await refreshData();
  };

  const handleBreakEnd = async () => {
    // 日跨ぎチェック: セッション開始日と今日が異なれば自動退勤・出勤
    const dayChangeResult = await handleDayChange();
    if (!dayChangeResult.ok) {
      toast({ description: dayChangeResult.error ?? "日跨ぎ処理に失敗しました", variant: "destructive" });
      return;
    }
    if (dayChangeResult.data) {
      // 日跨ぎがあった場合、休憩は新セッションでは始まっていないので、休憩終了は不要
      await refreshData();
      toast({ description: "日付が変わったため、自動で退勤・出勤しました" });
      setMyStatus("working");
      return;
    }

    const result = await breakEnd();
    if (!result.ok) {
      toast({ description: result.error ?? "休憩終了に失敗しました", variant: "destructive" });
      return;
    }
    setMyStatus("working"); // 即座にステータス更新
    toast({ description: "休憩を終了しました" });
    await refreshData();
  };

  const handleClockOut = async () => {
    // 日跨ぎチェック: セッション開始日と今日が異なれば自動退勤・出勤
    const dayChangeResult = await handleDayChange();
    if (!dayChangeResult.ok) {
      toast({ description: dayChangeResult.error ?? "日跨ぎ処理に失敗しました", variant: "destructive" });
      return;
    }
    if (dayChangeResult.data) {
      // 日跨ぎがあった場合、新セッションが開始されているので、そのまま退勤を続行
      await refreshData();
      toast({ description: "日付が変わったため、自動で退勤・出勤しました" });
    }

    const tasks = parseTaskLines(homeTaskDraft);
    const result = await clockOut(tasks);
    if (!result.ok) {
      toast({ description: result.error ?? "退勤に失敗しました", variant: "destructive" });
      return;
    }
    setMyStatus("off"); // 即座にステータス更新
    setShowThankYou(true); // お疲れ様画面を表示
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
      toast({ description: "開始時刻の形式が不正です", variant: "destructive" });
      return;
    }
    if (editEndAt && !endAtIso) {
      toast({ description: "終了時刻の形式が不正です", variant: "destructive" });
      return;
    }
    if (!editMessage.trim()) {
      toast({ description: "修正メッセージを入力してください", variant: "destructive" });
      return;
    }

    const result = await correctAttendance(editSession.id, startAtIso, endAtIso, editMessage);
    if (!result.ok) {
      toast({ description: result.error ?? "修正に失敗しました", variant: "destructive" });
      return;
    }
    setEditSessionId(null);
    setEditMessage("");
    toast({ description: "勤怠を修正しました" });
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

      {activeTab === "home" && role === "staff" && (
        <div className="space-y-4">
          {/* お疲れ様でした画面 */}
          {myStatus === "off" && showThankYou && (
            <div className="rounded-[var(--ds-radius-lg)] bg-[var(--status-approved)]/10 border border-[var(--status-approved)]/20 p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-[var(--status-approved)] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">お疲れ様でした！</h2>
              <p className="text-sm text-[var(--on-surface-variant)] mb-6">本日の勤務が完了しました</p>
              <button
                type="button"
                onClick={() => setShowThankYou(false)}
                className="rounded-[var(--ds-radius-pill)] bg-[var(--primary)] px-6 py-2.5 text-sm font-bold text-[var(--primary-foreground)] transition-all hover:bg-[var(--primary)]/90 shadow-[0_2px_8px_rgba(50,93,168,0.25)]"
              >
                閉じる
              </button>
            </div>
          )}

          {/* 現在時刻ヒーロー */}
          {!(myStatus === "off" && showThankYou) && (
            <>
              {/* シフト予定表示（fix/flex対応） */}
              {(() => {
                const todayStr = formatYmd(currentTime, "Asia/Tokyo");
                const { year: currentIsoYear, week: currentIsoWeek } = getISOWeekNumber(todayStr);
                const userRequestType = currentUser?.requestType ?? "fix";

                if (userRequestType === "fix") {
                  // fix勤務：今日の確定済み勤務予定を表示
                  const todayFixRequest = requests.find((r): r is FixRequest =>
                    r.type === "fix" &&
                    r.userId === currentUser?.id &&
                    r.status === "approved" &&
                    (r.approvedStartAt ?? r.requestedStartAt).startsWith(todayStr)
                  );

                  // シフトの開始・終了時刻
                  const shiftStartAt = todayFixRequest ? (todayFixRequest.approvedStartAt ?? todayFixRequest.requestedStartAt) : null;
                  const shiftEndAt = todayFixRequest ? (todayFixRequest.approvedEndAt ?? todayFixRequest.requestedEndAt) : null;

                  // シフトの予定時間（分）
                  const shiftMinutes = shiftStartAt && shiftEndAt
                    ? Math.max(0, Math.floor((new Date(shiftEndAt).getTime() - new Date(shiftStartAt).getTime()) / 60000))
                    : 0;

                  // 現在の勤務時間（分）- 勤務中の場合のみ
                  const workedMinutes = myOpenSession && myStatus !== "off"
                    ? Math.floor(calculateWorkingSeconds(myOpenSession, currentTime) / 60)
                    : 0;

                  // 進捗%
                  const progressPercent = shiftMinutes > 0 ? Math.round((workedMinutes / shiftMinutes) * 100) : 0;

                  // 時間外判定（シフト開始1時間以上前か、終了後に出勤）
                  const isOutsideSchedule = (() => {
                    if (!myOpenSession || !shiftStartAt || !shiftEndAt) return false;
                    const clockInTime = new Date(myOpenSession.start_at);
                    const shiftStart = new Date(shiftStartAt);
                    const shiftEnd = new Date(shiftEndAt);
                    const oneHourBefore = new Date(shiftStart.getTime() - 60 * 60 * 1000);
                    return clockInTime < oneHourBefore || clockInTime > shiftEnd;
                  })();

                  // プログレスバーの色判定
                  const getProgressColor = () => {
                    if (!todayFixRequest) return "bg-[var(--status-rejected)]"; // 未確定: 赤
                    if (progressPercent < 70) return "bg-[var(--status-approved)]"; // 0-70%: 緑
                    if (progressPercent <= 110) return "bg-[var(--primary)]"; // 70-110%: 通常
                    if (progressPercent <= 130) return "bg-[var(--status-pending)]"; // 110-130%: 注意
                    return "bg-[var(--status-rejected)]"; // 130%以上: 赤
                  };

                  const getProgressTextColor = () => {
                    if (!todayFixRequest) return "text-[var(--status-rejected)]";
                    if (progressPercent < 70) return "text-[var(--status-approved)]";
                    if (progressPercent <= 110) return "text-[var(--primary)]";
                    if (progressPercent <= 130) return "text-[var(--status-pending)]";
                    return "text-[var(--status-rejected)]";
                  };

                  // 勤務中の場合はプログレスバー付きで表示
                  if (myStatus !== "off") {
                    return (
                      <div className="rounded-[var(--ds-radius-sm)] bg-[var(--surface-container)] p-4 space-y-3">
                        {/* シフト未確定で勤務中の場合の警告 */}
                        {!todayFixRequest && (
                          <div className="flex items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--status-rejected)]/10 px-3 py-2">
                            <AlertTriangle className="h-4 w-4 text-[var(--status-rejected)]" />
                            <span className="text-sm text-[var(--status-rejected)]">本日の確定済みシフトがありません</span>
                          </div>
                        )}

                        {/* 時間外出勤の注意 */}
                        {todayFixRequest && isOutsideSchedule && (
                          <div className="flex items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--status-pending)]/10 px-3 py-2">
                            <AlertTriangle className="h-4 w-4 text-[var(--status-pending)]" />
                            <span className="text-sm text-[var(--status-pending)]">シフト時間外に出勤しています</span>
                          </div>
                        )}

                        {/* 130%超過警告 */}
                        {todayFixRequest && progressPercent > 130 && (
                          <div className="flex items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--status-rejected)]/10 px-3 py-2">
                            <AlertTriangle className="h-4 w-4 text-[var(--status-rejected)]" />
                            <span className="text-sm text-[var(--status-rejected)]">勤務時間が大幅に超過しています</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">本日</span>
                            <span className="text-xs text-[var(--on-surface-variant)]">
                              {formatDurationMinutes(workedMinutes)}{todayFixRequest ? ` / ${formatDurationMinutes(shiftMinutes)}` : ""}
                            </span>
                          </div>
                          <span className={cn("text-sm font-bold tabular-nums", getProgressTextColor())}>
                            {todayFixRequest ? `${progressPercent}%` : ""}
                          </span>
                        </div>

                        {/* プログレスバー */}
                        <div className="h-2 rounded-[var(--ds-radius-pill)] bg-[var(--surface-container-high)] overflow-hidden">
                          <div
                            className={cn("h-full rounded-[var(--ds-radius-pill)] transition-all", getProgressColor())}
                            style={{ width: todayFixRequest ? `${Math.min(progressPercent, 100)}%` : "100%" }}
                          />
                        </div>
                      </div>
                    );
                  }

                  // 勤務していない場合は予定のみ表示
                  if (todayFixRequest) {
                    return (
                      <div className="rounded-[var(--ds-radius-sm)] bg-[var(--surface-container)] p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-[var(--primary)]" />
                            <span className="text-sm font-semibold text-foreground">本日</span>
                          </div>
                          <span className="text-base font-semibold tabular-nums text-[var(--primary)]">
                            {formatJstTime(shiftStartAt!)} → {formatJstTime(shiftEndAt!)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  // 今日の勤務予定がない場合
                  return (
                    <div className="rounded-[var(--ds-radius-sm)] bg-[var(--surface-container)] p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-[var(--on-surface-variant)]" />
                          <span className="text-sm font-semibold text-foreground">本日</span>
                        </div>
                        <span className="text-sm text-[var(--on-surface-variant)]">シフトなし</span>
                      </div>
                    </div>
                  );
                } else {
                  // flex勤務：今週の確定済み勤務時間と現在までの勤務時間を表示
                  const thisWeekFlexRequest = requests.find((r): r is FlexRequest =>
                    r.type === "flex" &&
                    r.userId === currentUser?.id &&
                    r.status === "approved" &&
                    r.isoYear === currentIsoYear &&
                    r.isoWeek === currentIsoWeek
                  );

                  // 今週の勤務セッション（月曜〜日曜）の実働時間を計算
                  const weekStartDate = thisWeekFlexRequest?.weekStartDate ?? (() => {
                    // 今週の月曜日を計算
                    const d = new Date(todayStr + "T00:00:00");
                    const day = d.getDay();
                    const diff = day === 0 ? -6 : 1 - day;
                    d.setDate(d.getDate() + diff);
                    return formatYmd(d, "Asia/Tokyo");
                  })();

                  const weekEndDate = (() => {
                    const d = new Date(weekStartDate + "T00:00:00");
                    d.setDate(d.getDate() + 6);
                    return formatYmd(d, "Asia/Tokyo");
                  })();

                  const thisWeekSessions = sessions.filter((s) => {
                    if (s.user_id !== currentUser?.id) return false;
                    const sessionDate = s.start_at.split("T")[0];
                    return sessionDate >= weekStartDate && sessionDate <= weekEndDate;
                  });

                  const workedMinutes = thisWeekSessions.reduce((sum, s) => sum + getWorkMinutesDb(s), 0);
                  // 現在勤務中のセッションがあれば、その分も加算
                  const currentWorkingMinutes = myOpenSession && myStatus === "working"
                    ? Math.floor(calculateWorkingSeconds(myOpenSession, currentTime) / 60)
                    : 0;
                  const totalWorkedMinutes = workedMinutes + currentWorkingMinutes;

                  const approvedHours = thisWeekFlexRequest?.approvedHours ?? 0;
                  const approvedMinutes = approvedHours * 60;

                  // 進捗%（確定シフトがない場合は0%）
                  const progressPercent = approvedMinutes > 0 ? Math.round((totalWorkedMinutes / approvedMinutes) * 100) : 0;

                  // プログレスバーの色判定
                  const getProgressColor = () => {
                    if (!thisWeekFlexRequest) return "bg-[var(--status-rejected)]"; // 未確定: 赤
                    if (progressPercent < 70) return "bg-[var(--status-approved)]"; // 0-70%: 緑
                    if (progressPercent <= 110) return "bg-[var(--primary)]"; // 70-110%: 通常
                    if (progressPercent <= 130) return "bg-[var(--status-pending)]"; // 110-130%: 注意
                    return "bg-[var(--status-rejected)]"; // 130%以上: 赤
                  };

                  const getProgressTextColor = () => {
                    if (progressPercent < 70) return "text-[var(--status-approved)]";
                    if (progressPercent <= 110) return "text-[var(--primary)]";
                    if (progressPercent <= 130) return "text-[var(--status-pending)]";
                    return "text-[var(--status-rejected)]";
                  };

                  return (
                    <div className="rounded-[var(--ds-radius-sm)] bg-[var(--surface-container)] p-4 space-y-3">
                      {/* 未確定警告 */}
                      {!thisWeekFlexRequest && (
                        <div className="flex items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--status-rejected)]/10 px-3 py-2">
                          <AlertTriangle className="h-4 w-4 text-[var(--status-rejected)]" />
                          <span className="text-sm text-[var(--status-rejected)]">今週のシフトが未確定です</span>
                        </div>
                      )}

                      {/* 130%超過警告 */}
                      {thisWeekFlexRequest && progressPercent > 130 && (
                        <div className="flex items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--status-rejected)]/10 px-3 py-2">
                          <AlertTriangle className="h-4 w-4 text-[var(--status-rejected)]" />
                          <span className="text-sm text-[var(--status-rejected)]">勤務時間が大幅に超過しています</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">今週</span>
                          <span className="text-xs text-[var(--on-surface-variant)]">
                            {formatDurationMinutes(totalWorkedMinutes)}{thisWeekFlexRequest ? ` / ${approvedHours}h` : ""}
                          </span>
                        </div>
                        <span className={cn("text-sm font-bold tabular-nums", getProgressTextColor())}>
                          {thisWeekFlexRequest ? `${progressPercent}%` : ""}
                        </span>
                      </div>

                      {/* プログレスバー */}
                      <div className="h-2 rounded-[var(--ds-radius-pill)] bg-[var(--surface-container-high)] overflow-hidden">
                        <div
                          className={cn("h-full rounded-[var(--ds-radius-pill)] transition-all", getProgressColor())}
                          style={{ width: thisWeekFlexRequest ? `${Math.min(progressPercent, 100)}%` : "100%" }}
                        />
                      </div>
                    </div>
                  );
                }
              })()}

              <div className="rounded-[var(--ds-radius-lg)] bg-[var(--primary-container)] p-6">
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
                  "rounded-[var(--ds-radius-sm)] px-4 py-3",
                  myStatus === "working" && "bg-[var(--status-approved)]/10 border border-[var(--status-approved)]/20",
                  myStatus === "on_break" && "bg-[var(--primary)]/10 border border-[var(--primary)]/20",
                  myStatus === "off" && "bg-[var(--surface-container)]"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-sm)]",
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
                      <p className="text-sm font-semibold tabular-nums text-foreground">{formatJstTime(myOpenSession.start_at)}</p>
                    </div>
                  )}
                </div>

                {isClosingDay && (
                  <div className="mt-3 flex items-center gap-2 rounded-[var(--ds-radius-sm)] bg-[var(--status-pending)]/10 px-2.5 py-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--status-pending)] shrink-0" />
                    <span className="text-[11px] text-[var(--status-pending)]">
                      締め日のため日跨ぎ勤務不可
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* アクションボタン - 状態に応じて必要なものだけ表示 */}
          {!(myStatus === "off" && showThankYou) && (
            <div className={cn(
              "grid gap-2",
              myStatus === "off" ? "grid-cols-1" : "grid-cols-2"
            )}>
              {/* 未出勤 → 出勤ボタンのみ */}
              {myStatus === "off" && (
                <button
                  type="button"
                  onClick={handleClockInWithCheck}
                  className="group flex items-center justify-center gap-2 rounded-[var(--ds-radius-pill)] bg-[var(--primary)] py-4 px-6 text-[var(--primary-foreground)] transition-all hover:bg-[var(--primary)]/90 active:scale-[0.98] shadow-[0_4px_14px_rgba(50,93,168,0.3)]"
                >
                  <Play className="h-5 w-5" />
                  <span className="text-base font-bold">出勤する</span>
                </button>
              )}

              {/* 勤務中 → 休憩・退勤 */}
              {myStatus === "working" && (
                <>
                  <button
                    type="button"
                    onClick={handleBreakStart}
                    className="group flex items-center justify-center gap-2 rounded-[var(--ds-radius-pill)] border-2 border-[var(--primary)]/40 bg-[var(--primary)]/10 py-3.5 px-5 text-foreground transition-all hover:bg-[var(--primary)]/20 hover:border-[var(--primary)]/60 active:scale-[0.98]"
                  >
                    <Coffee className="h-5 w-5 text-[var(--primary)]" />
                    <span className="text-sm font-bold text-[var(--primary)]">休憩</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowClockOutConfirm(true)}
                    className="group flex items-center justify-center gap-2 rounded-[var(--ds-radius-pill)] border-2 border-[var(--outline-variant)] bg-[var(--surface-container)] py-3.5 px-5 text-foreground transition-all hover:bg-[var(--surface-container-high)] hover:border-[var(--on-surface-variant)]/40 active:scale-[0.98]"
                  >
                    <LogOut className="h-5 w-5 text-[var(--on-surface-variant)]" />
                    <span className="text-sm font-bold">退勤</span>
                  </button>
                </>
              )}

              {/* 休憩中 → 休憩終了のみ */}
              {myStatus === "on_break" && (
                <button
                  type="button"
                  onClick={handleBreakEnd}
                  className="group col-span-2 flex items-center justify-center gap-2 rounded-[var(--ds-radius-pill)] bg-[var(--primary)] py-4 px-6 text-[var(--primary-foreground)] transition-all hover:bg-[var(--primary)]/90 active:scale-[0.98] shadow-[0_4px_14px_rgba(50,93,168,0.3)]"
                >
                  <Play className="h-5 w-5" />
                  <span className="text-base font-bold">休憩終了</span>
                </button>
              )}
            </div>
          )}

          {/* タスク入力 */}
          {myStatus !== "off" && (
            <div className="rounded-[var(--ds-radius-lg)] bg-[var(--surface-container)] p-4">
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
                      className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-pill)] bg-[var(--primary)]/10 px-3 py-1.5 text-sm text-foreground"
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
                              lastSyncedTasksRef.current = JSON.stringify(tasks);
                              setTaskSaveStatus("saved");
                              setTimeout(() => setTaskSaveStatus("idle"), 3000);
                            } else {
                              toast({ description: result.error ?? "保存に失敗しました", variant: "destructive" });
                              setTaskSaveStatus("idle");
                            }
                          });
                        }}
                        className="ml-0.5 rounded-[var(--ds-radius-pill)] p-0.5 hover:bg-[var(--primary)]/20 transition-colors"
                        title="削除"
                      >
                        <svg className="h-3.5 w-3.5 text-[var(--on-surface-variant)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* 1行入力 + 送信ボタン */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="やったことを入力"
                  value={taskInputValue}
                  onChange={(e) => setTaskInputValue(e.target.value)}
                  className="flex-1 min-w-0 rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2.5 text-sm text-foreground placeholder:text-[var(--on-surface-variant)]/50 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  onKeyDown={(e) => {
                    // IME変換中は無視
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter" && taskInputValue.trim()) {
                      e.preventDefault();
                      const newTask = taskInputValue.trim();
                      const tasks = parseTaskLines(homeTaskDraft);
                      tasks.push(newTask);
                      const newValue = formatTaskLines(tasks);
                      setHomeTaskDraft(newValue);
                      setTaskInputValue("");

                      // 即保存
                      setTaskSaveStatus("saving");
                      saveCurrentTasksDb(tasks).then((result) => {
                        if (result.ok) {
                          lastSyncedTasksRef.current = JSON.stringify(tasks);
                          setTaskSaveStatus("saved");
                          setTimeout(() => setTaskSaveStatus("idle"), 3000);
                        } else {
                          toast({ description: result.error ?? "保存に失敗しました", variant: "destructive" });
                          setTaskSaveStatus("idle");
                        }
                      });
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!taskInputValue.trim()}
                  onClick={() => {
                    if (!taskInputValue.trim()) return;
                    const newTask = taskInputValue.trim();
                    const tasks = parseTaskLines(homeTaskDraft);
                    tasks.push(newTask);
                    const newValue = formatTaskLines(tasks);
                    setHomeTaskDraft(newValue);
                    setTaskInputValue("");

                    // 即保存
                    setTaskSaveStatus("saving");
                    saveCurrentTasksDb(tasks).then((result) => {
                      if (result.ok) {
                        lastSyncedTasksRef.current = JSON.stringify(tasks);
                        setTaskSaveStatus("saved");
                        setTimeout(() => setTaskSaveStatus("idle"), 3000);
                      } else {
                        toast({ description: result.error ?? "保存に失敗しました", variant: "destructive" });
                        setTaskSaveStatus("idle");
                      }
                    });
                  }}
                  className="shrink-0 rounded-[var(--ds-radius-pill)] bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] transition-all hover:bg-[var(--primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_6px_rgba(50,93,168,0.2)]"
                >
                  追加
                </button>
              </div>
            </div>
          )}

          {/* タイムライン（勤務中のみ表示・アコーディオン） */}
          {myStatus !== "off" && myOpenSession && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-container-high)] group">
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
                <div className="mt-2 rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] px-4 py-3">
                  <div className="relative pl-4">
                    {/* タイムライン縦線 */}
                    <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-[var(--outline-variant)]" />

                    <div className="space-y-2.5">
                      {buildTimelineEvents(myOpenSession).map((event) => (
                        <div key={event.id} className="relative flex items-center gap-3">
                          {/* ドット */}
                          <div
                            className={cn(
                              "absolute -left-4 flex h-4 w-4 items-center justify-center rounded-[var(--ds-radius-pill)] border-2 bg-[var(--surface-container)]",
                              event.type === "work_start" && "border-[var(--status-approved)]",
                              event.type === "work_end" && "border-[var(--on-surface-variant)]",
                              event.type === "break_start" && "border-[var(--primary)]",
                              event.type === "break_end" && "border-[var(--primary)]"
                            )}
                          >
                            <div
                              className={cn(
                                "h-2 w-2 rounded-[var(--ds-radius-pill)]",
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
                              {formatJstTime(event.time.toISOString())}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* 現在進行中インジケーター（点滅はここだけ） */}
                      {!myOpenSession.end_at && (
                        <div className="relative flex items-center gap-3">
                          <div className="absolute -left-4 flex h-4 w-4 items-center justify-center bg-[var(--surface-container)]">
                            <div className={cn(
                              "h-3 w-3 rounded-[var(--ds-radius-pill)] animate-pulse",
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
                              {formatJstTime(currentTime.toISOString())}
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
          <div className="flex items-center gap-3 rounded-[var(--ds-radius-lg)] bg-[var(--surface-container)] p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--primary)]/10">
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

          {/* 期間統計サマリー */}
          {(() => {
            const targetSessions = role === "staff" ? myPeriodSessions : managedSessions;
            const totalWorkMinutes = targetSessions.reduce((sum, s) => sum + getWorkMinutesDb(s), 0);
            // 同じ日は除外してユニークな出勤日をカウント
            const uniqueDates = new Set(
              targetSessions
                .filter(s => s.end_at !== null)
                .map(s => s.start_at.split("T")[0])
            );
            const workDays = uniqueDates.size;
            const totalHours = Math.floor(totalWorkMinutes / 60);
            const totalMins = totalWorkMinutes % 60;

            // 推定給与を計算
            // 期間の最終日時点で有効な時給を取得
            const periodEndDate = currentPeriod.endAt.split("T")[0];
            const applicableRate = getApplicableHourlyRate(hourlyRates, periodEndDate);
            const hourlyRate = applicableRate?.hourlyRate ?? 0;
            const estimatedSalary = Math.floor((totalWorkMinutes / 60) * hourlyRate);

            return (
              <div className="rounded-[var(--ds-radius-lg)] bg-[var(--primary-container)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[var(--primary)]">期間サマリー</span>
                  <span className="text-xs text-[var(--primary)]/70">
                    {currentPeriod.startAt.split("T")[0].replace(/-/g, "/")} 〜 {currentPeriod.endAt.split("T")[0].replace(/-/g, "/")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container-lowest)] p-3 text-center">
                    <p className="text-[10px] text-[var(--on-surface-variant)] mb-1">総労働</p>
                    <p className="text-lg font-bold tabular-nums text-[var(--primary)]">
                      {totalHours}<span className="text-xs font-medium">h</span>{totalMins > 0 && <>{totalMins}<span className="text-xs font-medium">m</span></>}
                    </p>
                  </div>
                  <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container-lowest)] p-3 text-center">
                    <p className="text-[10px] text-[var(--on-surface-variant)] mb-1">出勤日数</p>
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {workDays}<span className="text-xs font-medium">日</span>
                    </p>
                  </div>
                  <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container-lowest)] p-3 text-center">
                    <p className="text-[10px] text-[var(--on-surface-variant)] mb-1">推定給与</p>
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {hourlyRate > 0 ? `¥${estimatedSalary.toLocaleString()}` : "-"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* セッション一覧 */}
          <div className="space-y-3">
            {(role === "staff" ? myPeriodSessions : managedSessions).length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-[var(--ds-radius-lg)] bg-[var(--surface-container)] py-12 px-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[var(--ds-radius-pill)] bg-[var(--surface-container-high)]">
                  <Calendar className="h-8 w-8 text-[var(--on-surface-variant)]" />
                </div>
                <p className="mt-4 text-sm font-medium text-[var(--on-surface-variant)]">勤務データがありません</p>
              </div>
            )}

            {(role === "staff" ? myPeriodSessions : managedSessions).map((session) => {
              const breakMinutes = getBreakMinutesDb(session);
              const workMinutes = getWorkMinutesDb(session);
              const ownerName = nameByUserId.get(session.user_id) ?? "不明";
              const isOpen = session.end_at === null;

              return (
                <div key={session.id} className="rounded-[var(--ds-radius-lg)] bg-[var(--surface-container)] overflow-hidden">
                  {/* ヘッダー部分（日付・時間・統計） */}
                  <div className="p-4 pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* ステータスアイコン */}
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-md)] shrink-0",
                          isOpen ? "bg-[var(--status-approved)]/15" : "bg-[var(--surface-container-high)]"
                        )}>
                          {isOpen ? (
                            <Play className="h-4 w-4 text-[var(--status-approved)]" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-[var(--on-surface-variant)]" />
                          )}
                        </div>
                        {/* 日付・時間 */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {role !== "staff" && (
                              <span className="text-xs font-medium text-[var(--primary)]">{ownerName}</span>
                            )}
                            <span className="text-sm font-semibold text-foreground">
                              {formatJstDateLabel(session.start_at)}
                            </span>
                            {session.split_by_closing_boundary && (
                              <span className="rounded bg-[var(--status-pending)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--status-pending)]">
                                分割
                              </span>
                            )}
                            {isOpen && (
                              <span className="rounded bg-[var(--status-approved)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--status-approved)] animate-pulse">
                                勤務中
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--on-surface-variant)] tabular-nums mt-0.5">
                            {formatJstTime(session.start_at)} → {session.end_at ? formatJstTime(session.end_at) : "--:--"}
                          </p>
                        </div>
                      </div>
                      {/* 統計（右側） */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] text-[var(--on-surface-variant)]">休憩</p>
                          <p className="text-sm font-semibold tabular-nums text-foreground">{formatDurationMinutes(breakMinutes)}</p>
                        </div>
                        <div className="w-px h-6 bg-[var(--outline-variant)]" />
                        <div className="text-right">
                          <p className="text-[10px] text-[var(--on-surface-variant)]">実働</p>
                          <p className="text-sm font-semibold tabular-nums text-[var(--primary)]">{formatDurationMinutes(workMinutes)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* タスク部分（読み取り専用） */}
                  {session.tasks.length > 0 && (
                    <div className="border-t border-[var(--outline-variant)]/50 px-4 py-3">
                      <p className="text-xs font-medium text-[var(--on-surface-variant)] mb-2">やったこと</p>
                      <div className="flex flex-wrap gap-1.5">
                        {session.tasks.map((task, idx) => (
                          <span
                            key={`${session.id}-task-${idx}`}
                            className="rounded-[var(--ds-radius-pill)] bg-[var(--surface-container-high)] px-2.5 py-1 text-xs text-foreground"
                          >
                            {task}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 修正ボタン */}
                  {canCorrect && (
                    <div className="border-t border-[var(--outline-variant)]/50 px-4 py-2">
                      <button
                        type="button"
                        onClick={() => openCorrection(session)}
                        className="flex w-full items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary)]/80"
                      >
                        <Pencil className="h-3 w-3" />
                        修正
                      </button>
                    </div>
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
          <div className="rounded-[var(--ds-radius-lg)] bg-[var(--surface-container)] p-4 space-y-4">
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
          <div className="rounded-[var(--ds-radius-lg)] bg-[var(--surface-container)] p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-sm)]",
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
              <div className="flex items-center gap-3 rounded-[var(--ds-radius-md)] bg-[var(--status-approved)]/10 px-4 py-3">
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
                      className="flex items-start gap-3 rounded-[var(--ds-radius-md)] bg-[var(--status-rejected)]/5 border border-[var(--status-rejected)]/20 px-4 py-3"
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

      {/* 出勤警告モーダル */}
      {clockInWarningType && (
        <ShiftRequestModalFrame
          header={
            <span className="text-base font-semibold text-[var(--status-rejected)]">
              {clockInWarningType === "no-shift" && "シフト未確定"}
              {clockInWarningType === "early" && "出勤時間外"}
              {clockInWarningType === "late" && "出勤時間外"}
              {clockInWarningType === "overtime" && "勤務時間超過"}
            </span>
          }
          onClose={() => setClockInWarningType(null)}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setClockInWarningType(null)}
                className="flex-1 rounded-[var(--ds-radius-pill)] bg-[var(--surface-container-high)] py-3 text-sm font-bold text-foreground hover:bg-[var(--surface-container-highest)]"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleClockIn}
                className="flex-1 rounded-[var(--ds-radius-pill)] bg-[var(--status-rejected)] py-3 text-sm font-bold text-white hover:bg-[var(--status-rejected)]/90 shadow-[0_2px_8px_rgba(185,68,68,0.3)]"
              >
                出勤する
              </button>
            </div>
          }
        >
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center gap-3 rounded-[var(--ds-radius-sm)] bg-[var(--status-rejected)]/10 p-4">
              <AlertTriangle className="h-6 w-6 text-[var(--status-rejected)] shrink-0" />
              <div className="space-y-1">
                {clockInWarningType === "no-shift" && (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      {userRequestType === "fix" ? "本日の確定済みシフトがありません" : "今週の確定済みシフトがありません"}
                    </p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      シフト申請が承認されていない状態で出勤しようとしています。
                    </p>
                  </>
                )}
                {clockInWarningType === "early" && (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      シフト開始時刻の1時間以上前です
                    </p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      予定より早く出勤しようとしています。
                    </p>
                  </>
                )}
                {clockInWarningType === "late" && (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      シフト終了時刻を過ぎています
                    </p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      シフト終了後に出勤しようとしています。
                    </p>
                  </>
                )}
                {clockInWarningType === "overtime" && (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      {userRequestType === "fix" ? "本日の勤務時間が130%を超えています" : "週間勤務時間が130%を超えています"}
                    </p>
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      承認された勤務時間を大幅に超過しています。
                    </p>
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-[var(--on-surface-variant)]">
              このまま出勤してもよろしいですか？
            </p>
          </div>
        </ShiftRequestModalFrame>
      )}

      {/* 退勤確認モーダル */}
      {showClockOutConfirm && (
        <ShiftRequestModalFrame
          header={<span className="text-base font-semibold">退勤確認</span>}
          onClose={() => setShowClockOutConfirm(false)}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  const tasks = parseTaskLines(homeTaskDraft);
                  if (tasks.length === 0) {
                    toast({ description: "「やったこと」を1件以上入力してください", variant: "destructive" });
                    return;
                  }
                  await handleClockOut();
                  setShowClockOutConfirm(false);
                }}
                disabled={parseTaskLines(homeTaskDraft).length === 0}
                className={cn(
                  "flex-1 rounded-[var(--ds-radius-pill)] py-3 text-sm font-bold transition-all",
                  parseTaskLines(homeTaskDraft).length === 0
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 shadow-[0_2px_8px_rgba(50,93,168,0.25)]"
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

            {/* やったこと一覧 + 追加入力 */}
            <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] p-4 space-y-3">
              <p className="text-xs font-medium text-[var(--on-surface-variant)]">やったこと</p>
              {parseTaskLines(homeTaskDraft).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {parseTaskLines(homeTaskDraft).map((task, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-pill)] bg-[var(--primary)]/10 px-3 py-1.5 text-sm text-foreground"
                    >
                      {task}
                      <button
                        type="button"
                        onClick={() => {
                          const tasks = parseTaskLines(homeTaskDraft);
                          tasks.splice(idx, 1);
                          setHomeTaskDraft(formatTaskLines(tasks));
                        }}
                        className="ml-0.5 rounded-[var(--ds-radius-pill)] p-0.5 hover:bg-[var(--primary)]/20 transition-colors"
                        title="削除"
                      >
                        <svg className="h-3.5 w-3.5 text-[var(--on-surface-variant)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {parseTaskLines(homeTaskDraft).length === 0 && (
                <div className="flex items-center gap-2 text-[var(--status-rejected)]">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">「やったこと」を入力してください</span>
                </div>
              )}
              {/* モーダル内タスク追加 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="やったことを追加"
                  value={modalTaskInput}
                  onChange={(e) => setModalTaskInput(e.target.value)}
                  className="flex-1 min-w-0 rounded-[var(--ds-radius-sm)] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-foreground placeholder:text-[var(--on-surface-variant)]/50 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter" && modalTaskInput.trim()) {
                      e.preventDefault();
                      const tasks = parseTaskLines(homeTaskDraft);
                      tasks.push(modalTaskInput.trim());
                      setHomeTaskDraft(formatTaskLines(tasks));
                      setModalTaskInput("");
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!modalTaskInput.trim()}
                  onClick={() => {
                    if (!modalTaskInput.trim()) return;
                    const tasks = parseTaskLines(homeTaskDraft);
                    tasks.push(modalTaskInput.trim());
                    setHomeTaskDraft(formatTaskLines(tasks));
                    setModalTaskInput("");
                  }}
                  className="shrink-0 rounded-[var(--ds-radius-pill)] bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--primary-foreground)] transition-all hover:bg-[var(--primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_6px_rgba(50,93,168,0.2)]"
                >
                  追加
                </button>
              </div>
            </div>

            {myOpenSession && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-[var(--ds-radius-sm)] bg-[var(--surface-container)] p-3">
                  <p className="text-xs text-[var(--on-surface-variant)]">出勤時刻</p>
                  <p className="font-semibold tabular-nums">{formatJstTimeWithSeconds(myOpenSession.start_at)}</p>
                </div>
                <div className="rounded-[var(--ds-radius-sm)] bg-[var(--surface-container)] p-3">
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
