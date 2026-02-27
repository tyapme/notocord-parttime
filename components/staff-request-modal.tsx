"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { FixRequest, FlexRequest, Request } from "@/lib/types";
import {
  addMonths,
  buildDateOptions,
  buildWeekOptions,
  combineDateTimeToIso,
  diffMinutes,
  formatYmd,
  getISOMonday,
  getJstDateValue,
  getJstTimeValue,
} from "@/lib/datetime";
import { RequestHistoryToggle } from "@/components/request-history-toggle";
import { SelectField } from "@/components/select-field";
import { ShiftRequestModalFrame } from "@/components/shift-request-modal-frame";
import { NearTermContactWarning } from "@/components/near-term-contact-warning";
import { FixDetailRows, FlexDetailRows, TypeTag } from "@/components/shift-request-ui";
import { isNearTermShiftRequest } from "@/lib/request-urgency";

export function StaffRequestModal({
  request,
  onClose,
}: {
  request: Request;
  onClose: () => void;
}) {
  const currentUser = useAppStore((s) => s.currentUser);
  const currentUserId = currentUser?.id ?? "";
  const requests = useAppStore((s) => s.requests);
  const withdrawRequest = useAppStore((s) => s.withdrawRequest);
  const updateFixRequest = useAppStore((s) => s.updateFixRequest);
  const updateFlexRequest = useAppStore((s) => s.updateFlexRequest);
  const reopenFixRequest = useAppStore((s) => s.reopenFixRequest);
  const reopenFlexRequest = useAppStore((s) => s.reopenFlexRequest);
  const requestHistories = useAppStore((s) => s.requestHistories);
  const historyLoadingByRequestId = useAppStore((s) => s.historyLoadingByRequestId);
  const fetchRequestHistory = useAppStore((s) => s.fetchRequestHistory);

  const [editMode, setEditMode] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const [editFixDate, setEditFixDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("18:00");
  const [editFlexMonday, setEditFlexMonday] = useState("");
  const [editRequestedHours, setEditRequestedHours] = useState("");
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    setEditMode(false);
    setEditError(null);
    setShowWithdrawConfirm(false);
    setWithdrawReason("");
    setWithdrawError(null);
    if (request.type === "fix") {
      setEditFixDate(getJstDateValue(request.requestedStartAt));
      setEditStartTime(getJstTimeValue(request.requestedStartAt));
      setEditEndTime(getJstTimeValue(request.requestedEndAt));
      setEditNote(request.note ?? "");
      return;
    }
    setEditFlexMonday(request.weekStartDate);
    setEditRequestedHours(String(request.requestedHours));
    setEditNote(request.note ?? "");
  }, [request]);

  const todayYmd = formatYmd(new Date());
  const minFixDate = todayYmd;
  const maxDate = addMonths(todayYmd, 3);
  const dateOptions = buildDateOptions(120).filter(
    (d) => d.value >= minFixDate && d.value <= maxDate
  );
  const minFlexWeekMonday = getISOMonday(todayYmd);
  const weekOptions = buildWeekOptions(0, 52).filter(
    (w) => w.monday >= minFlexWeekMonday && w.monday <= maxDate
  );
  const takenFlexMondaysExcludingSelected = useMemo(
    () =>
      new Set(
        requests
          .filter(
            (r) =>
              r.type === "flex" &&
              r.userId === currentUserId &&
              (r.status === "pending" || r.status === "approved") &&
              r.id !== request.id
          )
          .map((r) => (r.type === "flex" ? r.weekStartDate : ""))
          .filter((v) => Boolean(v))
      ),
    [requests, currentUserId, request.id]
  );
  const editWeekOptions = useMemo(
    () =>
      weekOptions.map((w) => ({
        value: w.monday,
        label: w.label,
        disabled: takenFlexMondaysExcludingSelected.has(w.monday),
        disabledLabel: takenFlexMondaysExcludingSelected.has(w.monday) ? "申請済み" : undefined,
      })),
    [weekOptions, takenFlexMondaysExcludingSelected]
  );

  const showNearTermWithdrawWarning = isNearTermShiftRequest(request, 2);

  const handleSave = async () => {
    setEditError(null);
    let ok = false;
    if (request.type === "fix") {
      if (!editFixDate) {
        setEditError("日付を選択してください");
        return;
      }
      if (editFixDate < minFixDate) {
        setEditError("過去の日付は申請できません");
        return;
      }
      if (editFixDate > maxDate) {
        setEditError("申請は3ヶ月先までです");
        return;
      }
      const durationMinutes = diffMinutes(editStartTime, editEndTime);
      if (durationMinutes === null) { setEditError("時刻を正しく入力してください"); return; }
      if (durationMinutes <= 0) { setEditError("終了時刻は開始時刻より後にしてください"); return; }
      if (durationMinutes > 8 * 60) { setEditError("Fixは8時間以内で申請してください"); return; }
      const startAt = combineDateTimeToIso(editFixDate, editStartTime);
      const endAt = combineDateTimeToIso(editFixDate, editEndTime);
      ok = request.status === "approved"
        ? await reopenFixRequest(request.id, { startAt, endAt, note: editNote })
        : await updateFixRequest(request.id, { startAt, endAt, note: editNote });
    } else {
      if (!editFlexMonday || !editRequestedHours) {
        setEditError("週と時間数を入力してください");
        return;
      }
      if (editFlexMonday < minFlexWeekMonday) {
        setEditError("過去週の申請はできません");
        return;
      }
      if (editFlexMonday > maxDate) {
        setEditError("申請は3ヶ月先までです");
        return;
      }
      if (takenFlexMondaysExcludingSelected.has(editFlexMonday)) {
        setEditError("その週は申請済みです");
        return;
      }
      const hours = Number(editRequestedHours);
      if (!Number.isFinite(hours) || hours <= 0) { setEditError("希望時間数を正しく入力してください"); return; }
      if (hours > 40) { setEditError("Flexは40時間以内で申請してください"); return; }
      ok = request.status === "approved"
        ? await reopenFlexRequest(request.id, {
            dateInWeek: editFlexMonday,
            requestedHours: hours,
            note: editNote,
          })
        : await updateFlexRequest(request.id, {
            dateInWeek: editFlexMonday,
            requestedHours: hours,
            note: editNote,
          });
    }
    if (ok) onClose();
  };

  if (!currentUser) return null;

  if (showWithdrawConfirm) {
    return (
      <ShiftRequestModalFrame
        onClose={() => {
          setShowWithdrawConfirm(false);
          setWithdrawReason("");
          setWithdrawError(null);
        }}
        header={(
          <p className="text-sm font-bold text-foreground truncate">
            {request.status === "approved" ? "確定済みシフトを取り下げますか？" : "申請を取り下げますか？"}
          </p>
        )}
        bodyClassName="px-5 py-4 space-y-3.5"
        footer={(
          <button
            onClick={async () => {
              const reason = withdrawReason.trim();
              if (!reason) {
                setWithdrawError("取り下げ理由を入力してください");
                return;
              }
              const ok = await withdrawRequest(request.id, reason);
              if (ok) {
                setShowWithdrawConfirm(false);
                setWithdrawReason("");
                setWithdrawError(null);
                onClose();
              }
            }}
            className="button-primary w-full bg-[var(--status-withdrawn-bg)] text-[var(--status-withdrawn)]"
          >
            シフト取り下げ
          </button>
        )}
      >
        <div className="space-y-3.5">
          <div className="rounded-[var(--ds-radius-md)] border border-[var(--status-rejected)]/25 bg-[var(--status-rejected-bg)]/50 px-3.5 py-3">
            <p className="text-xs font-semibold text-[var(--status-rejected)]">この操作は取り消せません</p>
            <p className="mt-1 text-xs text-muted-foreground">取り下げ理由の入力が必要です。</p>
          </div>
          {showNearTermWithdrawWarning && (
            <NearTermContactWarning message="Slackでシフト取り下げについて連絡してください。" />
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">取り下げ理由（必須）</label>
            <textarea
              value={withdrawReason}
              onChange={(e) => {
                setWithdrawReason(e.target.value);
                if (withdrawError) setWithdrawError(null);
              }}
              rows={3}
              placeholder="例：都合により勤務不可"
              className="input-base resize-none md:text-sm"
            />
          </div>
          {withdrawError && <p className="text-xs font-medium text-[var(--status-rejected)]">{withdrawError}</p>}
        </div>
      </ShiftRequestModalFrame>
    );
  }

  return (
    <ShiftRequestModalFrame
      onClose={onClose}
      status={request.status}
      header={(
        <>
          <span className="text-sm font-bold text-foreground truncate">{request.userName ?? "不明"}</span>
          <TypeTag type={request.type} />
        </>
      )}
      bodyClassName="px-5 py-4 space-y-2.5"
      footer={(request.status === "pending" || request.status === "approved") ? (
        <div className="space-y-2">
          {!editMode && request.status === "pending" ? (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="button-secondary w-full text-sm"
              >
                編集する
              </button>
              <button
                onClick={() => {
                  setShowWithdrawConfirm(true);
                  setWithdrawReason("");
                  setWithdrawError(null);
                }}
                className="button-secondary w-full text-sm text-[var(--status-withdrawn)] hover:bg-[var(--status-withdrawn-bg)]"
              >
                シフト取り下げ
              </button>
            </>
          ) : !editMode && request.status === "approved" ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEditMode(true)}
                className="button-secondary text-sm"
              >
                変更して再申請
              </button>
              <button
                onClick={() => {
                  setShowWithdrawConfirm(true);
                  setWithdrawReason("");
                  setWithdrawError(null);
                }}
                className="button-secondary text-sm text-[var(--status-withdrawn)] hover:bg-[var(--status-withdrawn-bg)]"
              >
                シフト取り下げ
              </button>
            </div>
          ) : !editMode ? (
            <button
              onClick={() => {
                setShowWithdrawConfirm(true);
                setWithdrawReason("");
                setWithdrawError(null);
              }}
              className="button-secondary w-full text-sm text-[var(--status-withdrawn)] hover:bg-[var(--status-withdrawn-bg)]"
            >
              シフト取り下げ
            </button>
          ) : (
            <div className="flex gap-2.5">
              <button
                onClick={() => { setEditMode(false); setEditError(null); }}
                className="button-secondary flex-1 text-sm"
              >
                編集をやめる
              </button>
              <button
                onClick={handleSave}
                className="button-primary flex-1 text-sm"
              >
                {request.status === "approved" ? "変更申請する" : "保存する"}
              </button>
            </div>
          )}
        </div>
      ) : undefined}
    >
      {!editMode ? (
        request.type === "fix"
          ? <FixDetailRows req={request as FixRequest} />
          : <FlexDetailRows req={request as FlexRequest} />
      ) : (
        <div className="space-y-3">
          {request.status === "approved"}
          {request.type === "fix" ? (
            <>
              <SelectField
                label="日付"
                value={editFixDate}
                onChange={setEditFixDate}
                options={dateOptions.map((d) => ({ value: d.value, label: d.label }))}
                placeholder="日付を選択"
                className="max-w-[15rem]"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">開始時刻</label>
                  <input
                    type="time"
                    step={300}
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="input-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">終了時刻</label>
                  <input
                    type="time"
                    step={300}
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="input-base"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <SelectField
                label="対象週"
                value={editFlexMonday}
                onChange={setEditFlexMonday}
                options={editWeekOptions}
                placeholder="週を選択"
                className="max-w-[12.5rem]"
              />
              <div className="max-w-[12.5rem] space-y-1.5">
                <label className="text-sm font-medium text-foreground">希望時間数</label>
                <div className="relative">
                  <input
                    type="number"
                    value={editRequestedHours}
                    onChange={(e) => setEditRequestedHours(e.target.value)}
                    min={1}
                    max={40}
                    className="input-base pr-16 text-xl font-semibold tabular-nums"
                    inputMode="decimal"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--on-surface-variant)]">
                    時間
                  </span>
                </div>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">メッセージ（任意）</label>
            <p className="text-xs text-muted-foreground">レビュアーに表示されます</p>
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              rows={3}
              placeholder="伝達事項があれば入力"
              className="input-base resize-none"
            />
          </div>
          {editError && <p className="text-xs font-medium text-[var(--status-rejected)]">{editError}</p>}
        </div>
      )}
      <RequestHistoryToggle
        requestId={request.id}
        entries={requestHistories[request.id]}
        loading={historyLoadingByRequestId[request.id] ?? false}
        onLoad={fetchRequestHistory}
      />
    </ShiftRequestModalFrame>
  );
}
