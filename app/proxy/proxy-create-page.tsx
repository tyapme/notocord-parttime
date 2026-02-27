"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  addMonths,
  buildWeekOptions,
  combineDateTimeToIso,
  diffMinutes,
  formatYmd,
  getISOMonday,
  isValidYmd,
} from "@/lib/datetime";
import { DateInput } from "@/components/date-input";
import { SelectField } from "@/components/select-field";

export function ProxyCreateScreen() {
  const users = useAppStore((s) => s.users);
  const requests = useAppStore((s) => s.requests);
  const fetchUsers = useAppStore((s) => s.fetchUsers);
  const fetchRequests = useAppStore((s) => s.fetchRequests);
  const createFix = useAppStore((s) => s.proxyCreateFix);
  const createFlex = useAppStore((s) => s.proxyCreateFlex);
  const storeError = useAppStore((s) => s.error);

  const [targetUserId, setTargetUserId] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fix fields
  const [fixDate, setFixDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  // Flex fields
  const [flexMonday, setFlexMonday] = useState("");
  const [requestedHours, setRequestedHours] = useState("");

  const staffOptions = useMemo(
    () => users.filter((u) => u.role === "staff" && u.active),
    [users]
  );

  const selectedStaff = staffOptions.find((u) => u.id === targetUserId);
  const activeType: "fix" | "flex" | null = selectedStaff ? selectedStaff.requestType : null;

  const todayYmd = formatYmd(new Date());
  const minFixDate = todayYmd;
  const maxDate = addMonths(todayYmd, 3);
  const minFlexDate = todayYmd;
  const minFlexWeekMonday = getISOMonday(minFlexDate);
  const weekOptions = buildWeekOptions(0, 52).filter(
    (w) => w.monday >= minFlexWeekMonday && w.monday <= maxDate
  );
  const takenFlexMondays = useMemo(
    () =>
      new Set(
        requests
          .filter(
            (r) =>
              r.type === "flex" &&
              r.userId === targetUserId &&
              (r.status === "pending" || r.status === "approved")
          )
          .map((r) => (r.type === "flex" ? r.weekStartDate : ""))
          .filter((v) => Boolean(v))
      ),
    [requests, targetUserId]
  );
  const weekSelectOptions = useMemo(
    () =>
      weekOptions.map((w) => ({
        value: w.monday,
        label: w.label,
        disabled: takenFlexMondays.has(w.monday),
        disabledLabel: takenFlexMondays.has(w.monday) ? "申請済み" : undefined,
      })),
    [weekOptions, takenFlexMondays]
  );
  const selectedWeek = weekOptions.find((w) => w.monday === flexMonday);

  const formatBackendError = (msg?: string | null) => {
    if (!msg) return "代理作成に失敗しました";
    if (msg.includes("request_type_mismatch")) return "アルバイトの申請タイプと一致しません";
    if (msg.includes("flex_duplicate_week")) return "同一週のFlex申請が既に存在します";
    if (msg.includes("overlap")) return "同時間帯のFix申請が既に存在します";
    if (msg.includes("max_lead_time")) return "申請は3ヶ月先までです";
    if (msg.includes("max_hours")) return "時間数が上限を超えています";
    if (msg.includes("past_week_not_allowed") || msg.includes("past_not_allowed")) return "過去は申請できません";
    if (msg.includes("forbidden")) return "権限がありません";
    return msg;
  };

  useEffect(() => {
    void Promise.all([fetchUsers(), fetchRequests()]);
  }, [fetchUsers, fetchRequests]);

  useEffect(() => {
    setFixDate("");
    setFlexMonday("");
    setRequestedHours("");
    setError(null);
  }, [targetUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!selectedStaff) {
      setError("対象アルバイトを選択してください");
      return;
    }
    if (activeType !== "fix" && activeType !== "flex") {
      setError("対象アルバイトの申請タイプが未設定です");
      return;
    }

    setSubmitting(true);
    let ok = false;
    if (activeType === "fix") {
      if (!isValidYmd(fixDate)) {
        setError("日付を正しく入力してください");
        setSubmitting(false);
        return;
      }
      if (fixDate < minFixDate) { setError("過去の日付は申請できません"); setSubmitting(false); return; }
      if (fixDate > maxDate) { setError("申請は3ヶ月先までです"); setSubmitting(false); return; }
      const durationMinutes = diffMinutes(startTime, endTime);
      if (durationMinutes === null) { setError("時刻を正しく入力してください"); setSubmitting(false); return; }
      if (durationMinutes <= 0) { setError("終了時刻は開始時刻より後にしてください"); setSubmitting(false); return; }
      if (durationMinutes > 8 * 60) { setError("Fixは8時間以内で申請してください"); setSubmitting(false); return; }
      const startAt = combineDateTimeToIso(fixDate, startTime);
      const endAt = combineDateTimeToIso(fixDate, endTime);
      ok = await createFix({ userId: targetUserId, startAt, endAt, note });
    } else {
      if (!flexMonday) {
        setError("週を選択してください");
        setSubmitting(false);
        return;
      }
      if (flexMonday < minFlexWeekMonday) { setError("過去週の申請はできません"); setSubmitting(false); return; }
      if (flexMonday > maxDate) { setError("申請は3ヶ月先までです"); setSubmitting(false); return; }
      if (takenFlexMondays.has(flexMonday)) { setError("その週は申請済みです"); setSubmitting(false); return; }
      if (!requestedHours) {
        setError("勤務時間数を入力してください");
        setSubmitting(false);
        return;
      }
      const hours = Number(requestedHours);
      if (!Number.isFinite(hours) || hours <= 0) { setError("勤務時間数を正しく入力してください"); setSubmitting(false); return; }
      if (hours > 40) { setError("Flexは40時間以内で申請してください"); setSubmitting(false); return; }
      ok = await createFlex({
        userId: targetUserId,
        dateInWeek: flexMonday,
        requestedHours: hours,
        note,
      });
    }

    if (ok) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 1200);
      setNote("");
    } else {
      const latestError = useAppStore.getState().error;
      setError(formatBackendError(latestError || storeError));
    }
    setSubmitting(false);
  };

  return (
    <div className="w-full">
      <div className="mb-7">
        <h1 className="page-title">代理作成</h1>
        <p className="text-sm text-muted-foreground mt-1">
          代理作成は即時確定で保存されます
        </p>
      </div>

      {submitted ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="h-12 w-12 rounded-[var(--ds-radius-lg)] bg-accent flex items-center justify-center">
            <svg className="h-6 w-6 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-base font-bold text-foreground">代理作成が完了しました</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="surface-card space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <SelectField
            label="対象アルバイト"
            value={targetUserId}
            onChange={setTargetUserId}
            options={staffOptions.map((u) => ({ value: u.id, label: u.name }))}
            placeholder="アルバイトを選択"
            emptyLabel="対象アルバイトがいません"
            className="max-w-[12.5rem]"
          />

          <div className="inline-flex items-center gap-2 rounded-[var(--ds-radius-pill)] border border-[var(--outline-variant)] bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            申請タイプ
            <span className="rounded-[var(--ds-radius-pill)] bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary tracking-wide">
              {activeType ? (activeType === "flex" ? "FLEX" : "FIX") : "--"}
            </span>
          </div>

          {!selectedStaff ? (
            <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-4 py-4 text-xs text-muted-foreground">
              アルバイトを選択してください。
            </div>
          ) : activeType === "fix" ? (
            <>
              <DateInput
                label="日付"
                value={fixDate}
                onChange={setFixDate}
                min={minFixDate}
                max={maxDate}
                required
                helperText="過去の日付は申請できません（3ヶ月先まで）"
                className="max-w-[15rem]"
                inputClassName="text-base tabular-nums"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <label className="text-sm font-medium text-foreground">開始時刻</label>
                  <input
                    type="time"
                    step={300}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input-base w-full min-w-0"
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <label className="text-sm font-medium text-foreground">終了時刻</label>
                  <input
                    type="time"
                    step={300}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="input-base w-full min-w-0"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <SelectField
                label="対象週"
                value={flexMonday}
                onChange={setFlexMonday}
                options={weekSelectOptions}
                placeholder="週を選択"
                emptyLabel="選択可能な週がありません"
                className="max-w-[12.5rem]"
              />
              {selectedWeek && (
                <div className="rounded-[var(--ds-radius-md)] bg-accent/30 border border-primary/15 px-4 py-3">
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">選択中の週</p>
                  <p className="text-sm font-bold text-accent-foreground">{selectedWeek.label}</p>
                </div>
              )}
              <div className="max-w-[6.25rem] space-y-1.5">
                <label className="text-sm font-medium text-foreground">勤務時間数</label>
                <input
                  type="number"
                  value={requestedHours}
                  onChange={(e) => setRequestedHours(e.target.value)}
                  min={1}
                  max={40}
                  required
                  placeholder="40"
                  className="input-base text-center text-3xl font-bold tabular-nums tracking-tight"
                  inputMode="decimal"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">メッセージ（任意）</label>
            <p className="text-xs text-muted-foreground">対象スタッフとレビュアーに表示されます</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="伝達事項があれば入力"
              className="input-base resize-none"
            />
          </div>

          {error && <p className="text-xs font-medium text-[var(--status-rejected)]">{error}</p>}

          <button
            type="submit"
            className="button-primary w-full"
            disabled={submitting}
          >
            {submitting ? "作成中..." : "代理作成する"}
          </button>
        </form>
      )}
    </div>
  );
}
