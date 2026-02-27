"use client";

import { useMemo, useState } from "react";
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

export function NewRequestScreen({ onSuccess }: { onSuccess: () => void }) {
  const currentUser = useAppStore((s) => s.currentUser);
  const currentUserId = currentUser?.id ?? "";
  const requests = useAppStore((s) => s.requests);
  const addFixRequest = useAppStore((s) => s.addFixRequest);
  const addFlexRequest = useAppStore((s) => s.addFlexRequest);

  // Fix fields
  const [fixDate, setFixDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [fixNote, setFixNote] = useState("");

  // Flex fields
  const [flexMonday, setFlexMonday] = useState("");
  const [requestedHours, setRequestedHours] = useState("");
  const [flexNote, setFlexNote] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const type: "fix" | "flex" = currentUser?.requestType === "flex" ? "flex" : "fix";
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
              r.userId === currentUserId &&
              (r.status === "pending" || r.status === "approved")
          )
          .map((r) => (r.type === "flex" ? r.weekStartDate : ""))
          .filter((v) => Boolean(v))
      ),
    [requests, currentUserId]
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

  if (!currentUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (type === "fix") {
      if (!isValidYmd(fixDate)) { setError("日付を正しく入力してください"); return; }
      if (fixDate < minFixDate) { setError("過去の日付は申請できません"); return; }
      if (fixDate > maxDate) { setError("申請は3ヶ月先までです"); return; }
      const durationMinutes = diffMinutes(startTime, endTime);
      if (durationMinutes === null) { setError("時刻を正しく入力してください"); return; }
      if (durationMinutes <= 0) { setError("終了時刻は開始時刻より後にしてください"); return; }
      if (durationMinutes > 8 * 60) { setError("Fixは8時間以内で申請してください"); return; }
      const startAt = combineDateTimeToIso(fixDate, startTime);
      const endAt = combineDateTimeToIso(fixDate, endTime);
      addFixRequest({ startAt, endAt, note: fixNote }).then((ok) => {
        if (!ok) {
          setError("申請に失敗しました");
          return;
        }
        setSubmitted(true);
        setTimeout(() => onSuccess(), 1000);
      });
    } else {
      if (!flexMonday) { setError("週を選択してください"); return; }
      if (flexMonday < minFlexWeekMonday) { setError("過去週の申請はできません"); return; }
      if (flexMonday > maxDate) { setError("申請は3ヶ月先までです"); return; }
      if (takenFlexMondays.has(flexMonday)) { setError("その週は申請済みです"); return; }
      if (!requestedHours) { setError("希望時間数を入力してください"); return; }
      const hours = Number(requestedHours);
      if (!Number.isFinite(hours) || hours <= 0) { setError("希望時間数を正しく入力してください"); return; }
      if (hours > 40) { setError("Flexは40時間以内で申請してください"); return; }
      addFlexRequest({
        dateInWeek: flexMonday,
        requestedHours: hours,
        note: flexNote,
      }).then((ok) => {
        if (!ok) {
          setError("申請に失敗しました");
          return;
        }
        setSubmitted(true);
        setTimeout(() => onSuccess(), 1000);
      });
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="h-12 w-12 rounded-[var(--ds-radius-lg)] bg-accent flex items-center justify-center">
          <svg className="h-6 w-6 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-base font-bold text-foreground">申請を送信しました</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-7">
        <h1 className="page-title">申請する</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {type === "fix" ? "固定シフト申請" : "週次フレックス申請"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="surface-card space-y-5 px-5 py-5 sm:px-6 sm:py-6">
        <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          承認タイミングによっては希望に添えない可能性があります。余裕を持って申請してください。
        </div>
        <div className="inline-flex items-center gap-2 rounded-[var(--ds-radius-pill)] border border-[var(--outline-variant)] bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          申請タイプ
          <span className="rounded-[var(--ds-radius-pill)] bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary tracking-wide">
            {type === "fix" ? "FIX" : "FLEX"}
          </span>
        </div>
        {type === "fix" ? (
          <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">メッセージ（任意）</label>
              <p className="text-xs text-muted-foreground">レビュアーに表示されます</p>
              <textarea
                value={fixNote}
                onChange={(e) => setFixNote(e.target.value)}
                rows={3}
                placeholder="伝達事項があれば入力"
                className="input-base resize-none"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
            <div className="max-w-[12.5rem] space-y-1.5">
              <label className="text-sm font-medium text-foreground">希望時間数</label>
              <div className="relative">
                <input
                  type="number"
                  value={requestedHours}
                  onChange={(e) => setRequestedHours(e.target.value)}
                  min={1}
                  max={40}
                  required
                  placeholder="例: 40"
                  className="input-base pr-16 text-xl font-semibold tabular-nums"
                  inputMode="decimal"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--on-surface-variant)]">
                  時間
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">メッセージ（任意）</label>
              <p className="text-xs text-muted-foreground">レビュアーに表示されます</p>
              <textarea
                value={flexNote}
                onChange={(e) => setFlexNote(e.target.value)}
                rows={3}
                placeholder="伝達事項があれば入力"
                className="input-base resize-none"
              />
            </div>
          </div>
        )}

        {error && <p className="text-xs font-medium text-[var(--status-rejected)]">{error}</p>}

        <button
          type="submit"
          className="button-primary w-full"
        >
          申請を送信
        </button>
      </form>
    </div>
  );
}
