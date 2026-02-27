"use client";

import { useEffect, useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import { ShiftRequestModalFrame } from "@/components/shift-request-modal-frame";
import {
  ATTENDANCE_STORAGE_KEY,
  AttendancePeriod,
  AttendanceSession,
  applyManagerCorrection,
  createBreakEnd,
  createBreakStart,
  createClockIn,
  createClockOut,
  findAttendanceAnomalies,
  formatDurationMinutes,
  formatTaskLines,
  getBreakMinutes,
  getCurrentAttendanceStatus,
  getCurrentClosingPeriod,
  getCurrentOpenSession,
  getWorkMinutes,
  isClosingWarningDay,
  isSessionInPeriod,
  loadAttendanceSessions,
  parseTaskLines,
  saveCurrentTasks,
  saveSessionTasks,
  serializeAttendanceSessions,
} from "@/lib/attendance";
import { formatJstDateLabel, formatJstDateTime, formatJstTime } from "@/lib/datetime";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type AttendanceTab = "home" | "list" | "manage";

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

function statusLabel(status: ReturnType<typeof getCurrentAttendanceStatus>): string {
  if (status === "working") return "勤務中";
  if (status === "on_break") return "休憩中";
  return "未出勤";
}

function tabButtonClass(active: boolean): string {
  return cn(
    "relative inline-flex h-9 items-center px-3.5 text-xs font-medium whitespace-nowrap transition-colors",
    active ? "text-[var(--primary)]" : "text-[var(--on-surface-variant)] hover:text-foreground"
  );
}

function actionButtonClass(enabled: boolean, primary = false): string {
  if (primary) {
    return cn("button-primary w-full", !enabled && "bg-muted text-muted-foreground cursor-not-allowed");
  }
  return cn("button-secondary w-full", !enabled && "bg-muted text-muted-foreground cursor-not-allowed");
}

function AttendanceScreen() {
  const currentUser = useAppStore((state) => state.currentUser);
  const users = useAppStore((state) => state.users);
  const fetchUsers = useAppStore((state) => state.fetchUsers);

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<AttendanceTab>("home");

  const periodOptions = useMemo(() => buildPeriodOptions(), []);
  const [periodKey, setPeriodKey] = useState(periodOptions[0]?.key ?? "");

  const [homeTaskDraft, setHomeTaskDraft] = useState("");
  const [taskDraftBySessionId, setTaskDraftBySessionId] = useState<Record<string, string>>({});

  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [manageFilterUserId, setManageFilterUserId] = useState("all");

  useEffect(() => {
    const saved = loadAttendanceSessions(localStorage.getItem(ATTENDANCE_STORAGE_KEY));
    setSessions(saved);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, serializeAttendanceSessions(sessions));
  }, [sessions, loaded]);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === "staff") {
      setTab("home");
    } else {
      setTab("list");
      void fetchUsers({ force: true });
    }
  }, [currentUser, fetchUsers]);

  const currentPeriod = useMemo(
    () => periodOptions.find((item) => item.key === periodKey)?.period ?? periodOptions[0]?.period ?? getCurrentClosingPeriod(),
    [periodOptions, periodKey]
  );

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    if (currentUser) map.set(currentUser.id, currentUser.name);
    for (const user of users) map.set(user.id, user.name);
    return map;
  }, [currentUser, users]);

  const myOpenSession = useMemo(() => {
    if (!currentUser) return null;
    return getCurrentOpenSession(sessions, currentUser.id);
  }, [sessions, currentUser]);

  useEffect(() => {
    setHomeTaskDraft(myOpenSession ? formatTaskLines(myOpenSession.tasks) : "");
  }, [myOpenSession?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser) return null;

  const role = currentUser.role;
  const canCorrect = role === "reviewer" || role === "admin";
  const myStatus = getCurrentAttendanceStatus(sessions, currentUser.id);
  const isClosingDay = isClosingWarningDay();

  const myPeriodSessions = sessions.filter((session) => {
    if (session.userId !== currentUser.id) return false;
    return isSessionInPeriod(session, currentPeriod);
  });

  const managedSessions = sessions.filter((session) => {
    if (!isSessionInPeriod(session, currentPeriod)) return false;
    if (manageFilterUserId !== "all" && session.userId !== manageFilterUserId) return false;
    return true;
  });

  const anomalies = findAttendanceAnomalies(sessions).filter((item) => {
    const session = sessions.find((entry) => entry.id === item.sessionId);
    if (!session) return false;
    if (!isSessionInPeriod(session, currentPeriod)) return false;
    if (manageFilterUserId !== "all" && session.userId !== manageFilterUserId) return false;
    return true;
  });

  const editSession = editSessionId ? sessions.find((session) => session.id === editSessionId) ?? null : null;

  const setMutation = (result: { ok: boolean; sessions: AttendanceSession[]; error?: string; notice?: string }) => {
    if (!result.ok) {
      setError(result.error ?? "操作に失敗しました");
      return;
    }
    setSessions(result.sessions);
    setError("");
    setNotice(result.notice ?? "");
  };

  const handleClockIn = () => {
    setMutation(createClockIn(sessions, currentUser.id, new Date()));
  };

  const handleBreakStart = () => {
    setMutation(createBreakStart(sessions, currentUser.id, new Date()));
  };

  const handleBreakEnd = () => {
    setMutation(createBreakEnd(sessions, currentUser.id, new Date()));
  };

  const handleClockOut = () => {
    setMutation(createClockOut(sessions, currentUser.id, parseTaskLines(homeTaskDraft), new Date()));
  };

  const handleSaveCurrentTasks = () => {
    setMutation(saveCurrentTasks(sessions, currentUser.id, parseTaskLines(homeTaskDraft), new Date()));
  };

  const handleSaveSessionTasks = (session: AttendanceSession) => {
    const draft = taskDraftBySessionId[session.id] ?? formatTaskLines(session.tasks);
    const result =
      session.endAt === null && session.userId === currentUser.id
        ? saveCurrentTasks(sessions, currentUser.id, parseTaskLines(draft), new Date())
        : saveSessionTasks(sessions, session.id, currentUser.id, parseTaskLines(draft), new Date());
    setMutation(result);
  };

  const openCorrection = (session: AttendanceSession) => {
    setEditSessionId(session.id);
    setEditStartAt(toJstLocalInput(session.startAt));
    setEditEndAt(session.endAt ? toJstLocalInput(session.endAt) : "");
    setEditMessage("");
  };

  const handleSaveCorrection = () => {
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
    const result = applyManagerCorrection(
      sessions,
      editSession.id,
      {
        startAt: startAtIso,
        endAt: endAtIso,
        message: editMessage,
        actorId: currentUser.id,
        actorRole: currentUser.role,
      },
      new Date()
    );
    if (result.ok) {
      setEditSessionId(null);
      setEditMessage("");
    }
    setMutation(result);
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
        <p className="page-subtitle">20日締め運用（21日〜20日）</p>
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

      <div className="border-b border-[var(--outline-variant)]">
        <div className="flex h-10 items-center gap-1 overflow-x-auto no-scrollbar">
          {role === "staff" && (
            <button onClick={() => setTab("home")} className={tabButtonClass(tab === "home")}>
              勤怠ホーム
              {tab === "home" && <span className="absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full bg-[var(--primary)]" />}
            </button>
          )}
          <button onClick={() => setTab("list")} className={tabButtonClass(tab === "list")}>
            勤怠一覧
            {tab === "list" && <span className="absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full bg-[var(--primary)]" />}
          </button>
          {canCorrect && (
            <button onClick={() => setTab("manage")} className={tabButtonClass(tab === "manage")}>
              管理
              {tab === "manage" && <span className="absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full bg-[var(--primary)]" />}
            </button>
          )}
        </div>
      </div>

      {tab === "home" && role === "staff" && (
        <div className="space-y-4">
          <div className="surface-card-subtle p-4">
            <p className="text-xs text-[var(--on-surface-variant)]">現在の状態</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{statusLabel(myStatus)}</p>
            {isClosingDay && (
              <p className="mt-3 rounded-lg border border-[var(--status-pending)]/30 bg-[var(--status-pending-bg)] px-3 py-2 text-xs text-[var(--status-pending)]">
                今日は締め日です。日跨ぎ勤務はできません。24:00で勤務が分割されます。
              </p>
            )}
          </div>

          <div className="surface-card-subtle p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={handleClockIn} disabled={myStatus !== "off"} className={actionButtonClass(myStatus === "off", true)}>
                出勤
              </button>
              <button
                type="button"
                onClick={handleBreakStart}
                disabled={myStatus !== "working"}
                className={actionButtonClass(myStatus === "working")}
              >
                休憩開始
              </button>
              <button
                type="button"
                onClick={handleBreakEnd}
                disabled={myStatus !== "on_break"}
                className={actionButtonClass(myStatus === "on_break")}
              >
                休憩終了
              </button>
              <button
                type="button"
                onClick={handleClockOut}
                disabled={myStatus === "off"}
                className={actionButtonClass(myStatus !== "off")}
              >
                退勤
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">やったこと（1行1項目）</label>
              <textarea
                value={homeTaskDraft}
                onChange={(event) => {
                  setHomeTaskDraft(event.target.value);
                  setError("");
                }}
                rows={5}
                placeholder="接客対応\n在庫確認\nレジ締め"
                className="input-base min-h-[120px] resize-y"
              />
              <button type="button" onClick={handleSaveCurrentTasks} disabled={myStatus === "off"} className={actionButtonClass(myStatus !== "off")}>
                やったことを保存
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "list" && (
        <div className="space-y-4">
          <div className="surface-card-subtle p-4">
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

          <div className="space-y-3">
            {(role === "staff" ? myPeriodSessions : managedSessions).length === 0 && (
              <div className="surface-card-subtle p-4 text-sm text-[var(--on-surface-variant)]">勤務データがありません</div>
            )}

            {(role === "staff" ? myPeriodSessions : managedSessions).map((session) => {
              const breakMinutes = getBreakMinutes(session);
              const workMinutes = getWorkMinutes(session);
              const ownerName = nameByUserId.get(session.userId) ?? "不明";
              const draft = taskDraftBySessionId[session.id] ?? formatTaskLines(session.tasks);
              return (
                <div key={session.id} className="surface-card-subtle p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {role !== "staff" && <p className="text-xs text-[var(--on-surface-variant)]">{ownerName}</p>}
                      <p className="text-sm font-semibold text-foreground">
                        {formatJstDateLabel(session.startAt)} {formatJstTime(session.startAt)} 〜 {session.endAt ? formatJstTime(session.endAt) : "勤務中"}
                      </p>
                    </div>
                    {session.splitByClosingBoundary && (
                      <span className="rounded-full bg-[var(--status-pending-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--status-pending)]">
                        20日分割
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs text-[var(--on-surface-variant)]">
                    <p>休憩: {formatDurationMinutes(breakMinutes)}</p>
                    <p>実働: {formatDurationMinutes(workMinutes)}</p>
                    <p>状態: {session.endAt ? "退勤済み" : "勤務中"}</p>
                  </div>

                  {role === "staff" && session.userId === currentUser.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={draft}
                        onChange={(event) => {
                          setTaskDraftBySessionId((prev) => ({ ...prev, [session.id]: event.target.value }));
                        }}
                        className="input-base min-h-[96px] resize-y"
                      />
                      <button type="button" onClick={() => handleSaveSessionTasks(session)} className="button-secondary">
                        やったことを保存
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3 py-2">
                      {session.tasks.length === 0 ? (
                        <p className="text-xs text-[var(--on-surface-variant)]">記録なし</p>
                      ) : (
                        <ul className="space-y-1 text-xs text-foreground">
                          {session.tasks.map((item, index) => (
                            <li key={`${session.id}-task-${index}`}>・{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {canCorrect && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => openCorrection(session)} className="text-xs font-medium text-[var(--primary)] hover:underline">
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

      {tab === "manage" && canCorrect && (
        <div className="space-y-4">
          <div className="surface-card-subtle p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField label="対象期間" value={periodKey} onChange={setPeriodKey} options={periodOptions.map((item) => ({ value: item.key, label: item.label }))} />
              <SelectField label="対象者" value={manageFilterUserId} onChange={setManageFilterUserId} options={userFilterOptions} />
            </div>
          </div>

          <div className="surface-card-subtle p-4 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">異常一覧</h2>
            {anomalies.length === 0 ? (
              <p className="text-xs text-[var(--on-surface-variant)]">異常はありません</p>
            ) : (
              <div className="space-y-2">
                {anomalies.map((item) => {
                  const session = sessions.find((entry) => entry.id === item.sessionId);
                  if (!session) return null;
                  return (
                    <div key={item.id} className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3 py-2">
                      <p className="text-xs font-semibold text-foreground">{item.message}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--on-surface-variant)]">
                        {nameByUserId.get(item.userId) ?? "不明"} / {formatJstDateTime(session.startAt)}
                      </p>
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
              <input type="datetime-local" value={editStartAt} onChange={(event) => setEditStartAt(event.target.value)} className="input-base" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">終了時刻（任意）</label>
              <input type="datetime-local" value={editEndAt} onChange={(event) => setEditEndAt(event.target.value)} className="input-base" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">修正メッセージ（必須）</label>
              <textarea value={editMessage} onChange={(event) => setEditMessage(event.target.value)} rows={4} className="input-base min-h-[96px] resize-y" />
            </div>
          </div>
        </ShiftRequestModalFrame>
      )}
    </div>
  );
}

export default function Page() {
  return <AttendanceScreen />;
}
