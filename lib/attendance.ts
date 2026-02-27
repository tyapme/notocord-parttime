import { Role } from "@/lib/types";

export const ATTENDANCE_STORAGE_KEY = "notocord_attendance_v2";
const JST_TIMEZONE = "Asia/Tokyo";
const AUTO_SPLIT_TASK_MESSAGE = "20日締めを跨いだため強制退勤";

export type AttendanceStatus = "off" | "working" | "on_break";

export interface AttendanceBreak {
  id: string;
  startAt: string;
  endAt: string | null;
}

export interface AttendanceCorrection {
  id: string;
  actorId: string;
  actorRole: "reviewer" | "admin";
  message: string;
  createdAt: string;
  beforeStartAt: string;
  beforeEndAt: string | null;
  afterStartAt: string;
  afterEndAt: string | null;
}

export interface AttendanceSession {
  id: string;
  userId: string;
  startAt: string;
  endAt: string | null;
  breaks: AttendanceBreak[];
  tasks: string[];
  splitByClosingBoundary: boolean;
  continuedFromClosingBoundary: boolean;
  corrections: AttendanceCorrection[];
  createdAt: string;
  updatedAt: string;
}

export interface AttendancePeriod {
  startAt: string;
  endAt: string;
  label: string;
}

export interface AttendanceMutationResult {
  ok: boolean;
  sessions: AttendanceSession[];
  error?: string;
  notice?: string;
}

export interface AttendanceAnomaly {
  id: string;
  type: "open_shift" | "open_break" | "closing_split";
  sessionId: string;
  userId: string;
  message: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function makeJstIso(year: number, month: number, day: number, hour: number, minute: number, second: number): string {
  return new Date(`${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+09:00`).toISOString();
}

function addMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(`${year}-${pad2(month)}-01T00:00:00+09:00`);
  date.setMonth(date.getMonth() + delta);
  const y = Number(new Intl.DateTimeFormat("en-CA", { timeZone: JST_TIMEZONE, year: "numeric" }).format(date));
  const m = Number(new Intl.DateTimeFormat("en-CA", { timeZone: JST_TIMEZONE, month: "2-digit" }).format(date));
  return { year: y, month: m };
}

function getJstParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

function getOpenSessionIndex(sessions: AttendanceSession[], userId: string): number {
  return sessions.findLastIndex((session) => session.userId === userId && session.endAt === null);
}

function getOpenBreakIndex(session: AttendanceSession): number {
  return session.breaks.findLastIndex((item) => item.endAt === null);
}

function cloneSessions(sessions: AttendanceSession[]): AttendanceSession[] {
  return sessions.map((session) => ({
    ...session,
    breaks: session.breaks.map((item) => ({ ...item })),
    tasks: [...session.tasks],
    corrections: session.corrections.map((item) => ({ ...item })),
  }));
}

function sanitizeTasks(tasks: string[]): string[] {
  return tasks.map((item) => item.trim()).filter(Boolean);
}

export function parseTaskLines(input: string): string[] {
  return sanitizeTasks(input.split("\n"));
}

export function formatTaskLines(tasks: string[]): string {
  return sanitizeTasks(tasks).join("\n");
}

export function getCurrentAttendanceStatus(sessions: AttendanceSession[], userId: string): AttendanceStatus {
  const openSessionIndex = getOpenSessionIndex(sessions, userId);
  if (openSessionIndex < 0) return "off";
  const openSession = sessions[openSessionIndex];
  return getOpenBreakIndex(openSession) >= 0 ? "on_break" : "working";
}

export function getCurrentOpenSession(sessions: AttendanceSession[], userId: string): AttendanceSession | null {
  const index = getOpenSessionIndex(sessions, userId);
  if (index < 0) return null;
  return sessions[index];
}

function getNextClosingBoundary(sessionStartIso: string): Date {
  const start = new Date(sessionStartIso);
  const { year, month, day } = getJstParts(start);
  if (day <= 20) {
    return new Date(makeJstIso(year, month, 21, 0, 0, 0));
  }
  const next = addMonth(year, month, 1);
  return new Date(makeJstIso(next.year, next.month, 21, 0, 0, 0));
}

function ensureClosingBoundarySplit(
  sessions: AttendanceSession[],
  userId: string,
  now: Date
): { sessions: AttendanceSession[]; splitOccurred: boolean } {
  const nextSessions = cloneSessions(sessions);
  const nowIso = now.toISOString();
  let splitOccurred = false;

  while (true) {
    const openSessionIndex = getOpenSessionIndex(nextSessions, userId);
    if (openSessionIndex < 0) break;

    const openSession = nextSessions[openSessionIndex];
    const boundary = getNextClosingBoundary(openSession.startAt);
    if (now.getTime() < boundary.getTime()) break;

    const splitEndIso = new Date(boundary.getTime() - 1000).toISOString();
    const openBreakIndex = getOpenBreakIndex(openSession);
    if (openBreakIndex >= 0) {
      openSession.breaks[openBreakIndex].endAt = splitEndIso;
    }

    openSession.endAt = splitEndIso;
    if (!openSession.tasks.includes(AUTO_SPLIT_TASK_MESSAGE)) {
      openSession.tasks.push(AUTO_SPLIT_TASK_MESSAGE);
    }
    openSession.splitByClosingBoundary = true;
    openSession.updatedAt = nowIso;

    const continuedSession: AttendanceSession = {
      id: crypto.randomUUID(),
      userId,
      startAt: boundary.toISOString(),
      endAt: null,
      breaks: [],
      tasks: [],
      splitByClosingBoundary: false,
      continuedFromClosingBoundary: true,
      corrections: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    nextSessions.push(continuedSession);
    splitOccurred = true;
  }

  return { sessions: nextSessions, splitOccurred };
}

function sortSessions(sessions: AttendanceSession[]): AttendanceSession[] {
  return [...sessions].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}

export function createClockIn(
  sessions: AttendanceSession[],
  userId: string,
  now: Date = new Date()
): AttendanceMutationResult {
  const nextSessions = cloneSessions(sessions);
  if (getOpenSessionIndex(nextSessions, userId) >= 0) {
    return { ok: false, sessions, error: "すでに勤務中です" };
  }
  const nowIso = now.toISOString();
  nextSessions.push({
    id: crypto.randomUUID(),
    userId,
    startAt: nowIso,
    endAt: null,
    breaks: [],
    tasks: [],
    splitByClosingBoundary: false,
    continuedFromClosingBoundary: false,
    corrections: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  return { ok: true, sessions: sortSessions(nextSessions), notice: "出勤しました" };
}

export function createBreakStart(
  sessions: AttendanceSession[],
  userId: string,
  now: Date = new Date()
): AttendanceMutationResult {
  const split = ensureClosingBoundarySplit(sessions, userId, now);
  const nextSessions = split.sessions;
  const openSessionIndex = getOpenSessionIndex(nextSessions, userId);
  if (openSessionIndex < 0) {
    return { ok: false, sessions, error: "勤務中ではありません" };
  }
  const openSession = nextSessions[openSessionIndex];
  if (getOpenBreakIndex(openSession) >= 0) {
    return { ok: false, sessions, error: "すでに休憩中です" };
  }

  openSession.breaks.push({ id: crypto.randomUUID(), startAt: now.toISOString(), endAt: null });
  openSession.updatedAt = now.toISOString();
  return {
    ok: true,
    sessions: sortSessions(nextSessions),
    notice: split.splitOccurred
      ? "締め日のため勤務を分割しました（20日分は23:59で確定、21日分は0:00から継続）"
      : "休憩を開始しました",
  };
}

export function createBreakEnd(
  sessions: AttendanceSession[],
  userId: string,
  now: Date = new Date()
): AttendanceMutationResult {
  const split = ensureClosingBoundarySplit(sessions, userId, now);
  const nextSessions = split.sessions;
  const openSessionIndex = getOpenSessionIndex(nextSessions, userId);
  if (openSessionIndex < 0) {
    return { ok: false, sessions, error: "勤務中ではありません" };
  }
  const openSession = nextSessions[openSessionIndex];
  const openBreakIndex = getOpenBreakIndex(openSession);
  if (openBreakIndex < 0) {
    return { ok: false, sessions, error: "休憩中ではありません" };
  }

  openSession.breaks[openBreakIndex].endAt = now.toISOString();
  openSession.updatedAt = now.toISOString();
  return {
    ok: true,
    sessions: sortSessions(nextSessions),
    notice: split.splitOccurred
      ? "締め日のため勤務を分割しました（20日分は23:59で確定、21日分は0:00から継続）"
      : "休憩を終了しました",
  };
}

export function saveCurrentTasks(
  sessions: AttendanceSession[],
  userId: string,
  tasks: string[],
  now: Date = new Date()
): AttendanceMutationResult {
  const split = ensureClosingBoundarySplit(sessions, userId, now);
  const nextSessions = split.sessions;
  const openSessionIndex = getOpenSessionIndex(nextSessions, userId);
  if (openSessionIndex < 0) {
    return { ok: false, sessions, error: "勤務中ではありません" };
  }
  const openSession = nextSessions[openSessionIndex];
  openSession.tasks = sanitizeTasks(tasks);
  openSession.updatedAt = now.toISOString();
  return {
    ok: true,
    sessions: sortSessions(nextSessions),
    notice: split.splitOccurred
      ? "締め日のため勤務を分割しました（20日分は23:59で確定、21日分は0:00から継続）"
      : "やったことを保存しました",
  };
}

export function saveSessionTasks(
  sessions: AttendanceSession[],
  sessionId: string,
  userId: string,
  tasks: string[],
  now: Date = new Date()
): AttendanceMutationResult {
  const nextSessions = cloneSessions(sessions);
  const target = nextSessions.find((session) => session.id === sessionId && session.userId === userId);
  if (!target) {
    return { ok: false, sessions, error: "対象の勤務が見つかりません" };
  }
  target.tasks = sanitizeTasks(tasks);
  target.updatedAt = now.toISOString();
  return { ok: true, sessions: sortSessions(nextSessions), notice: "やったことを保存しました" };
}

export function createClockOut(
  sessions: AttendanceSession[],
  userId: string,
  tasks: string[],
  now: Date = new Date()
): AttendanceMutationResult {
  const split = ensureClosingBoundarySplit(sessions, userId, now);
  const nextSessions = split.sessions;
  const openSessionIndex = getOpenSessionIndex(nextSessions, userId);
  if (openSessionIndex < 0) {
    return { ok: false, sessions, error: "勤務中ではありません" };
  }

  const openSession = nextSessions[openSessionIndex];
  openSession.tasks = sanitizeTasks(tasks);
  if (openSession.tasks.length === 0) {
    return { ok: false, sessions, error: "退勤時は「やったこと」を1項目以上入力してください" };
  }

  const nowIso = now.toISOString();
  let notice = "退勤しました";
  const openBreakIndex = getOpenBreakIndex(openSession);
  if (openBreakIndex >= 0) {
    openSession.breaks[openBreakIndex].endAt = nowIso;
    notice = "休憩を終了して退勤しました";
  }
  openSession.endAt = nowIso;
  openSession.updatedAt = nowIso;

  if (split.splitOccurred) {
    notice = "締め日のため勤務を分割しました（20日分は23:59で確定、21日分は0:00から継続）";
  }

  return {
    ok: true,
    sessions: sortSessions(nextSessions),
    notice,
  };
}

export function applyManagerCorrection(
  sessions: AttendanceSession[],
  sessionId: string,
  payload: {
    startAt: string;
    endAt: string | null;
    message: string;
    actorId: string;
    actorRole: Role;
  },
  now: Date = new Date()
): AttendanceMutationResult {
  if (!(payload.actorRole === "reviewer" || payload.actorRole === "admin")) {
    return { ok: false, sessions, error: "修正権限がありません" };
  }
  const message = payload.message.trim();
  if (!message) {
    return { ok: false, sessions, error: "修正メッセージを入力してください" };
  }
  if (!payload.startAt) {
    return { ok: false, sessions, error: "開始時刻を入力してください" };
  }
  if (payload.endAt && new Date(payload.endAt).getTime() <= new Date(payload.startAt).getTime()) {
    return { ok: false, sessions, error: "終了時刻は開始時刻より後にしてください" };
  }

  const nextSessions = cloneSessions(sessions);
  const target = nextSessions.find((session) => session.id === sessionId);
  if (!target) {
    return { ok: false, sessions, error: "対象の勤務が見つかりません" };
  }

  const nowIso = now.toISOString();
  const beforeStartAt = target.startAt;
  const beforeEndAt = target.endAt;
  target.startAt = payload.startAt;
  target.endAt = payload.endAt;
  target.updatedAt = nowIso;

  target.breaks = target.breaks.map((item) => {
    let nextStartAt = item.startAt;
    let nextEndAt = item.endAt;
    if (new Date(nextStartAt).getTime() < new Date(target.startAt).getTime()) {
      nextStartAt = target.startAt;
    }
    if (target.endAt && (!nextEndAt || new Date(nextEndAt).getTime() > new Date(target.endAt).getTime())) {
      nextEndAt = target.endAt;
    }
    if (nextEndAt && new Date(nextEndAt).getTime() < new Date(nextStartAt).getTime()) {
      nextEndAt = nextStartAt;
    }
    return {
      ...item,
      startAt: nextStartAt,
      endAt: nextEndAt,
    };
  });

  target.corrections.unshift({
    id: crypto.randomUUID(),
    actorId: payload.actorId,
    actorRole: payload.actorRole,
    message,
    createdAt: nowIso,
    beforeStartAt,
    beforeEndAt,
    afterStartAt: target.startAt,
    afterEndAt: target.endAt,
  });

  return {
    ok: true,
    sessions: sortSessions(nextSessions),
    notice: "勤務を修正しました",
  };
}

export function getCurrentClosingPeriod(now: Date = new Date()): AttendancePeriod {
  const jst = getJstParts(now);
  const currentMonth = { year: jst.year, month: jst.month };
  const previousMonth = addMonth(jst.year, jst.month, -1);
  const nextMonth = addMonth(jst.year, jst.month, 1);
  const start = jst.day >= 21
    ? makeJstIso(currentMonth.year, currentMonth.month, 21, 0, 0, 0)
    : makeJstIso(previousMonth.year, previousMonth.month, 21, 0, 0, 0);
  const end = jst.day >= 21
    ? makeJstIso(nextMonth.year, nextMonth.month, 20, 23, 59, 59)
    : makeJstIso(currentMonth.year, currentMonth.month, 20, 23, 59, 59);

  const label = `${new Intl.DateTimeFormat("ja-JP", { timeZone: JST_TIMEZONE, year: "numeric", month: "numeric", day: "numeric" }).format(new Date(start))} 〜 ${new Intl.DateTimeFormat("ja-JP", { timeZone: JST_TIMEZONE, year: "numeric", month: "numeric", day: "numeric" }).format(new Date(end))}`;
  return { startAt: start, endAt: end, label };
}

export function isSessionInPeriod(session: AttendanceSession, period: AttendancePeriod, now: Date = new Date()): boolean {
  const periodStart = new Date(period.startAt).getTime();
  const periodEnd = new Date(period.endAt).getTime();
  const sessionStart = new Date(session.startAt).getTime();
  const sessionEnd = new Date(session.endAt ?? now.toISOString()).getTime();
  return sessionStart <= periodEnd && sessionEnd >= periodStart;
}

export function isClosingWarningDay(now: Date = new Date()): boolean {
  return getJstParts(now).day === 20;
}

export function findAttendanceAnomalies(
  sessions: AttendanceSession[],
  now: Date = new Date()
): AttendanceAnomaly[] {
  const anomalies: AttendanceAnomaly[] = [];
  for (const session of sessions) {
    if (session.endAt === null) {
      anomalies.push({
        id: `open_shift:${session.id}`,
        type: "open_shift",
        sessionId: session.id,
        userId: session.userId,
        message: "未退勤（勤務中のまま）",
      });
      if (getOpenBreakIndex(session) >= 0) {
        anomalies.push({
          id: `open_break:${session.id}`,
          type: "open_break",
          sessionId: session.id,
          userId: session.userId,
          message: "休憩未終了（休憩中のまま）",
        });
      }
    }
    if (session.splitByClosingBoundary) {
      const inRecentWindow = new Date(session.updatedAt).getTime() > now.getTime() - 1000 * 60 * 60 * 24 * 90;
      if (inRecentWindow) {
        anomalies.push({
          id: `closing_split:${session.id}`,
          type: "closing_split",
          sessionId: session.id,
          userId: session.userId,
          message: "20日締め分割が発生",
        });
      }
    }
  }
  return anomalies;
}

export function getBreakMinutes(session: AttendanceSession, now: Date = new Date()): number {
  return session.breaks.reduce((sum, item) => {
    const start = new Date(item.startAt).getTime();
    const end = new Date(item.endAt ?? now.toISOString()).getTime();
    const diff = Math.max(0, end - start);
    return sum + Math.floor(diff / 60000);
  }, 0);
}

export function getWorkMinutes(session: AttendanceSession, now: Date = new Date()): number {
  const start = new Date(session.startAt).getTime();
  const end = new Date(session.endAt ?? now.toISOString()).getTime();
  const gross = Math.max(0, end - start);
  const net = Math.floor(gross / 60000) - getBreakMinutes(session, now);
  return Math.max(0, net);
}

export function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h <= 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

export function loadAttendanceSessions(raw: string | null): AttendanceSession[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is AttendanceSession => {
        return Boolean(row && typeof row.id === "string" && typeof row.userId === "string" && typeof row.startAt === "string");
      })
      .map((row) => ({
        id: row.id,
        userId: row.userId,
        startAt: row.startAt,
        endAt: row.endAt ?? null,
        breaks: Array.isArray(row.breaks) ? row.breaks.map((item) => ({
          id: item.id,
          startAt: item.startAt,
          endAt: item.endAt ?? null,
        })) : [],
        tasks: Array.isArray(row.tasks) ? sanitizeTasks(row.tasks) : [],
        splitByClosingBoundary: Boolean(row.splitByClosingBoundary),
        continuedFromClosingBoundary: Boolean(row.continuedFromClosingBoundary),
        corrections: Array.isArray(row.corrections) ? row.corrections.map((item) => ({
          id: item.id,
          actorId: item.actorId,
          actorRole: item.actorRole,
          message: item.message,
          createdAt: item.createdAt,
          beforeStartAt: item.beforeStartAt,
          beforeEndAt: item.beforeEndAt ?? null,
          afterStartAt: item.afterStartAt,
          afterEndAt: item.afterEndAt ?? null,
        })) : [],
        createdAt: row.createdAt ?? row.startAt,
        updatedAt: row.updatedAt ?? row.startAt,
      }));
  } catch {
    return [];
  }
}

export function serializeAttendanceSessions(sessions: AttendanceSession[]): string {
  return JSON.stringify(sortSessions(sessions));
}
