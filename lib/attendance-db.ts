/**
 * 勤怠データのSupabase連携
 * 既存のlib/attendance.tsのロジックをDB永続化に対応
 */

import { supabase } from "@/lib/supabase/client";

export type AttendanceStatusDb = "off" | "working" | "on_break";

export interface AttendanceBreakDb {
  id: string;
  start_at: string;
  end_at: string | null;
}

export interface AttendanceCorrectionDb {
  id: string;
  actor_id: string;
  actor_role: "reviewer" | "admin";
  message: string;
  before_start_at: string;
  before_end_at: string | null;
  after_start_at: string;
  after_end_at: string | null;
  created_at: string;
}

export interface AttendanceSessionDb {
  id: string;
  user_id: string;
  start_at: string;
  end_at: string | null;
  tasks: string[];
  split_by_closing_boundary: boolean;
  continued_from_closing_boundary: boolean;
  created_at: string;
  updated_at: string;
  breaks: AttendanceBreakDb[];
  corrections: AttendanceCorrectionDb[];
}

export interface AttendanceResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * 勤怠状態を取得
 */
export async function getAttendanceStatus(userId?: string): Promise<AttendanceStatusDb> {
  const { data, error } = await supabase.rpc("get_attendance_status", {
    p_user_id: userId ?? null,
  });
  if (error) {
    console.error("get_attendance_status error:", error);
    return "off";
  }
  return (data as AttendanceStatusDb) ?? "off";
}

/**
 * 出勤
 */
export async function clockIn(): Promise<AttendanceResult<string>> {
  const { data, error } = await supabase.rpc("clock_in");
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as string };
}

/**
 * 退勤
 */
export async function clockOut(tasks: string[]): Promise<AttendanceResult> {
  const { error } = await supabase.rpc("clock_out", {
    p_tasks: tasks,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * 休憩開始
 */
export async function breakStart(): Promise<AttendanceResult<string>> {
  const { data, error } = await supabase.rpc("break_start");
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as string };
}

/**
 * 休憩終了
 */
export async function breakEnd(): Promise<AttendanceResult> {
  const { error } = await supabase.rpc("break_end");
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * 勤務中のタスクを保存
 */
export async function saveCurrentTasks(tasks: string[]): Promise<AttendanceResult> {
  const { error } = await supabase.rpc("save_current_tasks", {
    p_tasks: tasks,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * 過去セッションのタスクを保存
 */
export async function saveSessionTasks(sessionId: string, tasks: string[]): Promise<AttendanceResult> {
  const { error } = await supabase.rpc("save_session_tasks", {
    p_session_id: sessionId,
    p_tasks: tasks,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * 管理者による勤怠修正
 */
export async function correctAttendance(
  sessionId: string,
  startAt: string,
  endAt: string | null,
  message: string
): Promise<AttendanceResult> {
  const { error } = await supabase.rpc("correct_attendance", {
    p_session_id: sessionId,
    p_start_at: startAt,
    p_end_at: endAt,
    p_message: message,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * 勤怠セッション一覧を取得
 */
export async function getAttendanceSessions(params?: {
  userId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}): Promise<AttendanceResult<AttendanceSessionDb[]>> {
  const { data, error } = await supabase.rpc("get_attendance_sessions", {
    p_user_id: params?.userId ?? null,
    p_start_date: params?.startDate ?? null,
    p_end_date: params?.endDate ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // JSONBからの変換
  const sessions: AttendanceSessionDb[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    start_at: row.start_at as string,
    end_at: row.end_at as string | null,
    tasks: row.tasks as string[],
    split_by_closing_boundary: row.split_by_closing_boundary as boolean,
    continued_from_closing_boundary: row.continued_from_closing_boundary as boolean,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    breaks: (row.breaks as AttendanceBreakDb[]) ?? [],
    corrections: (row.corrections as AttendanceCorrectionDb[]) ?? [],
  }));

  return { ok: true, data: sessions };
}

/**
 * 休憩時間（分）を計算
 */
export function getBreakMinutesDb(session: AttendanceSessionDb, now?: Date): number {
  const refTime = now ?? new Date();
  let total = 0;
  for (const brk of session.breaks) {
    const start = new Date(brk.start_at);
    const end = brk.end_at ? new Date(brk.end_at) : refTime;
    total += Math.max(0, (end.getTime() - start.getTime()) / 60000);
  }
  return Math.round(total);
}

/**
 * 実働時間（分）を計算
 */
export function getWorkMinutesDb(session: AttendanceSessionDb, now?: Date): number {
  const refTime = now ?? new Date();
  const start = new Date(session.start_at);
  const end = session.end_at ? new Date(session.end_at) : refTime;
  const totalMinutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
  const breakMinutes = getBreakMinutesDb(session, now);
  return Math.round(totalMinutes - breakMinutes);
}

/**
 * 時間をフォーマット (例: "2時間30分")
 */
export function formatDurationMinutesDb(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
}
