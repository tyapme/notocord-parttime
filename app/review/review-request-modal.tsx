"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { FixRequest, FlexRequest, Request } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ShiftRequestModalFrame } from "@/components/shift-request-modal-frame";
import {
  buildDateOptions,
  combineDateTimeToIso,
  diffMinutes,
  getJstDateValue,
  getJstTimeValue,
} from "@/lib/datetime";
import { NearTermContactWarning } from "@/components/near-term-contact-warning";
import { RequestHistoryToggle } from "@/components/request-history-toggle";
import { FixDetail, FlexDetail, RadioOption, TypeTag } from "./review-modal-sections";
import { isNearTermShiftRequest } from "@/lib/request-urgency";

type FixAction = "approve" | "modify" | "reject";
type FlexAction = "approve" | "modify" | "reject";

const DATE_OPTS = buildDateOptions(120);
const DATE_MIN = DATE_OPTS[0]?.value ?? "";
const DATE_MAX = DATE_OPTS[DATE_OPTS.length - 1]?.value ?? "";

const FIX_ACTIONS: { value: FixAction; label: string; desc: string }[] = [
  { value: "approve", label: "承認", desc: "申請通りに承認" },
  { value: "modify", label: "変更承認", desc: "日時/時間を変更して承認" },
  { value: "reject", label: "却下", desc: "申請を受理しない" },
];

const FLEX_ACTIONS: { value: FlexAction; label: string; desc: string }[] = [
  { value: "approve", label: "承認", desc: "申請時間数をそのまま承認" },
  { value: "modify", label: "変更承認", desc: "時間数を変更して承認" },
  { value: "reject", label: "却下", desc: "申請を受理しない" },
];

export function ReviewRequestModal({
  request,
  onClose,
}: {
  request: Request;
  onClose: () => void;
}) {
  const currentUser = useAppStore((s) => s.currentUser);
  const reviewFix = useAppStore((s) => s.reviewFixRequest);
  const reviewFlex = useAppStore((s) => s.reviewFlexRequest);
  const cancelApproved = useAppStore((s) => s.cancelApprovedRequest);
  const requestHistories = useAppStore((s) => s.requestHistories);
  const historyLoadingByRequestId = useAppStore((s) => s.historyLoadingByRequestId);
  const fetchRequestHistory = useAppStore((s) => s.fetchRequestHistory);

  const [fixAction, setFixAction] = useState<FixAction | null>(null);
  const [approvedStartDate, setApprovedStartDate] = useState("");
  const [approvedStart, setApprovedStart] = useState("");
  const [approvedEnd, setApprovedEnd] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [reviewerNote, setReviewerNote] = useState("");
  const [approvedEditMode, setApprovedEditMode] = useState(false);
  const [approvedEditError, setApprovedEditError] = useState<string | null>(null);
  const [confirmCancelMode, setConfirmCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [flexAction, setFlexAction] = useState<FlexAction | null>(null);
  const [partialHours, setPartialHours] = useState("");

  useEffect(() => {
    setFixAction(null);
    setApprovedStartDate("");
    setApprovedStart("");
    setApprovedEnd("");
    setChangeReason("");
    setReviewerNote(request.reviewerNote ?? "");
    setApprovedEditMode(false);
    setApprovedEditError(null);
    setConfirmCancelMode(false);
    setCancelReason("");
    setCancelError(null);
    setFlexAction(null);
    if (request.type === "fix") {
      const fix = request as FixRequest;
      const startBase = fix.approvedStartAt ?? fix.requestedStartAt;
      const endBase = fix.approvedEndAt ?? fix.requestedEndAt;
      setApprovedStartDate(getJstDateValue(startBase));
      setApprovedStart(getJstTimeValue(startBase));
      setApprovedEnd(getJstTimeValue(endBase));
      if (fix.decisionType === "modify") {
        setChangeReason(fix.changeReason ?? "");
      }
      setPartialHours("");
      return;
    }
    const flex = request as FlexRequest;
    if (flex.approvedHours != null) {
      setPartialHours(String(flex.approvedHours));
    } else {
      setPartialHours(String(flex.requestedHours));
    }
  }, [request]);

  const isPending = request.status === "pending";
  const isApproved = request.status === "approved";
  const isReviewable = isPending || isApproved;
  const showNearTermCancelWarning = isApproved && isNearTermShiftRequest(request, 2);

  const canUseFixEditFields =
    (request.type === "fix" && isApproved && approvedEditMode) || fixAction === "modify";
  const fixDurationMinutes = (() => {
    if (!canUseFixEditFields) return null;
    if (!approvedStartDate || !approvedStart || !approvedEnd) return null;
    return diffMinutes(approvedStart, approvedEnd);
  })();

  const fixDurationError =
    canUseFixEditFields && fixDurationMinutes !== null
      ? fixDurationMinutes <= 0
        ? "終了時刻は開始時刻より後にしてください"
        : fixDurationMinutes > 8 * 60
          ? "Fixは8時間以内で確定してください"
          : null
      : null;
  const fixDraftRange =
    request.type === "fix" &&
    approvedStartDate &&
    approvedStart &&
    approvedEnd
      ? {
          startIso: combineDateTimeToIso(approvedStartDate, approvedStart),
          endIso: combineDateTimeToIso(approvedStartDate, approvedEnd),
        }
      : null;
  const fixOutsideRequestedWindow =
    request.type === "fix" &&
    fixDraftRange !== null &&
    (new Date(fixDraftRange.startIso).getTime() < new Date(request.requestedStartAt).getTime() ||
      new Date(fixDraftRange.endIso).getTime() > new Date(request.requestedEndAt).getTime());
  const flexDraftHours = Number(partialHours);
  const flexApprovedHoursIncreased =
    request.type === "flex" &&
    Number.isFinite(flexDraftHours) &&
    flexDraftHours > request.requestedHours;

  const canConfirmFix = (() => {
    if (!fixAction) return false;
    if (fixAction === "approve") return true;
    if (fixAction === "reject") return true;
    if (!approvedStartDate || !approvedStart || !approvedEnd) return false;
    if (fixAction === "modify" && !changeReason.trim()) return false;
    if (fixAction === "modify" && fixDurationError) return false;
    return fixAction === "modify";
  })();

  const canConfirmFlex = (() => {
    if (!flexAction) return false;
    if (!currentUser) return false;
    if (flexAction === "approve") return true;
    if (flexAction === "reject") return true;
    if (flexAction === "modify" && request.type === "flex") {
      const h = Number(partialHours);
      if (!partialHours) return false;
      if (!Number.isFinite(h) || h < 1) return false;
      if (h > 40) return false;
      return h !== (request as FlexRequest).requestedHours;
    }
    return false;
  })();

  const canSaveApprovedEdit = (() => {
    if (!isApproved || !approvedEditMode) return false;
    if (request.type === "fix") {
      if (!approvedStartDate || !approvedStart || !approvedEnd) return false;
      if (fixDurationError) return false;
      const nextStart = combineDateTimeToIso(approvedStartDate, approvedStart);
      const nextEnd = combineDateTimeToIso(approvedStartDate, approvedEnd);
      const fix = request as FixRequest;
      const changedFromRequested =
        nextStart !== fix.requestedStartAt || nextEnd !== fix.requestedEndAt;
      if (changedFromRequested && !changeReason.trim()) return false;
      return true;
    }
    const h = Number(partialHours);
    if (!partialHours || !Number.isFinite(h) || h <= 0 || h > 40) return false;
    return true;
  })();

  const handleFixDecide = async () => {
    if (!currentUser || !fixAction) return;
    if (fixAction === "approve") {
      const ok = await reviewFix(request.id, { decisionType: "approve", reviewerNote: reviewerNote || undefined });
      if (ok) onClose();
      return;
    }
    if (fixAction === "reject") {
      const ok = await reviewFix(request.id, { decisionType: "reject", reviewerNote: reviewerNote || undefined });
      if (ok) onClose();
      return;
    }
    const approvedStartAt = combineDateTimeToIso(approvedStartDate, approvedStart);
    const approvedEndAt = combineDateTimeToIso(approvedStartDate, approvedEnd);
    const ok = await reviewFix(request.id, {
      decisionType: "modify",
      approvedStartAt,
      approvedEndAt,
      changeReason: changeReason || undefined,
      reviewerNote: reviewerNote || undefined,
    });
    if (ok) onClose();
  };

  const handleFlexDecide = async () => {
    if (!currentUser || !flexAction || request.type !== "flex") return;
    const flex = request as FlexRequest;
    if (flexAction === "approve") {
      const ok = await reviewFlex(request.id, { decisionType: "approve", approvedHours: flex.requestedHours, reviewerNote: reviewerNote || undefined });
      if (ok) onClose();
    } else if (flexAction === "modify") {
      const ok = await reviewFlex(request.id, { decisionType: "modify", approvedHours: Number(partialHours), reviewerNote: reviewerNote || undefined });
      if (ok) onClose();
    } else {
      const ok = await reviewFlex(request.id, { decisionType: "reject", reviewerNote: reviewerNote || undefined });
      if (ok) onClose();
    }
  };

  const handleCancelApproved = async () => {
    if (request.status !== "approved") return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError("取り下げ理由を入力してください");
      return;
    }
    const ok = await cancelApproved(request.id, reason);
    if (ok) onClose();
  };

  const handleSaveApprovedEdit = async () => {
    if (request.status !== "approved") return;
    setApprovedEditError(null);

    if (request.type === "fix") {
      if (!approvedStartDate || !approvedStart || !approvedEnd) {
        setApprovedEditError("日付・開始時刻・終了時刻を入力してください");
        return;
      }
      if (fixDurationError) {
        setApprovedEditError(fixDurationError);
        return;
      }
      const nextStart = combineDateTimeToIso(approvedStartDate, approvedStart);
      const nextEnd = combineDateTimeToIso(approvedStartDate, approvedEnd);
      const fix = request as FixRequest;
      const changedFromRequested =
        nextStart !== fix.requestedStartAt || nextEnd !== fix.requestedEndAt;
      if (changedFromRequested && !changeReason.trim()) {
        setApprovedEditError("変更理由を入力してください");
        return;
      }
      const ok = await reviewFix(request.id, changedFromRequested
        ? {
            decisionType: "modify",
            approvedStartAt: nextStart,
            approvedEndAt: nextEnd,
            changeReason: changeReason || undefined,
            reviewerNote: reviewerNote || undefined,
          }
        : {
            decisionType: "approve",
            reviewerNote: reviewerNote || undefined,
          });
      if (ok) onClose();
      return;
    }

    const flex = request as FlexRequest;
    const h = Number(partialHours);
    if (!Number.isFinite(h) || h <= 0 || h > 40) {
      setApprovedEditError("確定時間数を正しく入力してください（1〜40）");
      return;
    }
    const ok = await reviewFlex(
      request.id,
      h === flex.requestedHours
        ? { decisionType: "approve", approvedHours: h, reviewerNote: reviewerNote || undefined }
        : { decisionType: "modify", approvedHours: h, reviewerNote: reviewerNote || undefined }
    );
    if (ok) onClose();
  };

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
      footer={!isReviewable ? (
        <button onClick={onClose} className="button-secondary w-full text-sm text-muted-foreground">
          閉じる
        </button>
      ) : undefined}
    >
          <div className="px-5 py-4 space-y-2.5">
            {request.type === "fix"
              ? <FixDetail req={request as FixRequest} />
              : <FlexDetail req={request as FlexRequest} />}
            <RequestHistoryToggle
              requestId={request.id}
              entries={requestHistories[request.id]}
              loading={historyLoadingByRequestId[request.id] ?? false}
              onLoad={fetchRequestHistory}
            />
          </div>

          {isReviewable && (
            <div className="px-5 pb-5 modal-divider space-y-3">
              {isPending && request.type === "fix" && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">処理を選択</p>
                  <div className="space-y-2">
                    {FIX_ACTIONS.map((a) => (
                      <RadioOption
                        key={a.value}
                        selected={fixAction === a.value}
                        label={a.label}
                        desc={a.desc}
                        onClick={() => setFixAction(a.value)}
                      />
                    ))}
                  </div>
                  {fixAction === "modify" && (
                    <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-4 py-4 space-y-3 mt-1">
                      <div className="max-w-[15rem] space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">日付</label>
                        <input
                          type="date"
                          value={approvedStartDate}
                          onChange={(e) => setApprovedStartDate(e.target.value)}
                          min={DATE_MIN}
                          max={DATE_MAX}
                          className="input-base w-full min-w-0 md:text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">開始時刻</label>
                          <input type="time" step={300} value={approvedStart} onChange={(e) => setApprovedStart(e.target.value)} className="input-base w-full min-w-0 md:text-sm" />
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">終了時刻</label>
                          <input type="time" step={300} value={approvedEnd} onChange={(e) => setApprovedEnd(e.target.value)} className="input-base w-full min-w-0 md:text-sm" />
                        </div>
                      </div>
                      {fixDurationError && <p className="text-xs font-medium text-[var(--status-rejected)]">{fixDurationError}</p>}
                      {fixOutsideRequestedWindow && (
                        <div className="rounded-[var(--ds-radius-md)] border border-[var(--status-pending)]/30 bg-[var(--status-pending-bg)]/35 px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-[var(--status-pending)]">申請時間帯をはみ出しています</p>
                          <p className="mt-0.5 text-[11px] text-[var(--on-surface-variant)]">スタッフへ連絡することを推奨します。</p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">変更理由（必須）</label>
                        <textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} placeholder="例：業務都合により日程変更" className="input-base resize-none md:text-sm" />
                      </div>
                    </div>
                  )}
                  <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-4 py-4 mt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">メッセージ（任意）</label>
                      <p className="text-[11px] text-muted-foreground">スタッフに表示されます</p>
                      <textarea value={reviewerNote} onChange={(e) => setReviewerNote(e.target.value)} rows={2} placeholder="必要があればメッセージを入力" className="input-base resize-none md:text-sm" />
                    </div>
                  </div>
                  <button
                    onClick={handleFixDecide}
                    disabled={!canConfirmFix}
                    className={cn(
                      "button-primary w-full",
                      canConfirmFix ? "" : "bg-muted text-muted-foreground cursor-not-allowed hover:opacity-100"
                    )}
                  >
                    {fixAction ? (FIX_ACTIONS.find((a) => a.value === fixAction)?.label ?? "確定") + "する" : "処理を選択してください"}
                  </button>
                </>
              )}

              {isPending && request.type === "flex" && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">処理を選択</p>
                  <div className="space-y-2">
                    {FLEX_ACTIONS.map((a) => (
                      <RadioOption
                        key={a.value}
                        selected={flexAction === a.value}
                        label={a.label}
                        desc={a.desc}
                        onClick={() => setFlexAction(a.value)}
                      />
                    ))}
                  </div>
                  {flexAction === "modify" && (
                    <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-4 py-4 mt-1">
                      <div className="max-w-[12.5rem] space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">確定時間数（最大 40時間）</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={partialHours}
                            onChange={(e) => setPartialHours(e.target.value)}
                            min={1}
                            max={40}
                            placeholder="1 〜 40"
                            className="input-base pr-16 text-xl font-semibold tabular-nums"
                            inputMode="decimal"
                            autoFocus
                          />
                          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--on-surface-variant)]">
                            時間
                          </span>
                        </div>
                      </div>
                      {flexApprovedHoursIncreased && (
                        <div className="mt-2 rounded-[var(--ds-radius-md)] border border-[var(--status-pending)]/30 bg-[var(--status-pending-bg)]/35 px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-[var(--status-pending)]">申請時間数を上回っています</p>
                          <p className="mt-0.5 text-[11px] text-[var(--on-surface-variant)]">スタッフへ連絡することを推奨します。</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-4 py-4 mt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">メッセージ（任意）</label>
                      <p className="text-[11px] text-muted-foreground">スタッフに表示されます</p>
                      <textarea value={reviewerNote} onChange={(e) => setReviewerNote(e.target.value)} rows={2} placeholder="必要があればメッセージを入力" className="input-base resize-none md:text-sm" />
                    </div>
                  </div>
                  <button
                    onClick={handleFlexDecide}
                    disabled={!canConfirmFlex}
                    className={cn(
                      "button-primary w-full",
                      canConfirmFlex ? "" : "bg-muted text-muted-foreground cursor-not-allowed hover:opacity-100"
                    )}
                  >
                    {flexAction ? (FLEX_ACTIONS.find((a) => a.value === flexAction)?.label ?? "確定") + "する" : "処理を選択してください"}
                  </button>
                </>
              )}

              {isApproved && !approvedEditMode && (
                <>
                  {!confirmCancelMode ? (
                    <>
                      <p className="text-xs text-muted-foreground">確定済みです。編集して再確定するか、シフトを取り下げできます。</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setApprovedEditMode(true);
                            setApprovedEditError(null);
                            setConfirmCancelMode(false);
                          }}
                          className="button-primary text-sm"
                        >
                          編集する
                        </button>
                        <button
                          onClick={() => {
                            setConfirmCancelMode(true);
                            setCancelReason("");
                            setCancelError(null);
                          }}
                          className="button-secondary text-sm font-semibold text-[var(--status-withdrawn)] hover:bg-[var(--status-withdrawn-bg)]"
                        >
                          シフトを取り下げ
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-[var(--ds-radius-md)] border border-[var(--status-rejected)]/25 bg-[var(--status-rejected-bg)]/50 px-3.5 py-3">
                        <p className="text-xs font-semibold text-[var(--status-rejected)]">この操作は取り消せません</p>
                        <p className="mt-1 text-xs text-muted-foreground">取り下げ理由の入力が必要です。</p>
                      </div>
                      {showNearTermCancelWarning && (
                        <NearTermContactWarning message="対象アルバイトにご連絡ください。" />
                      )}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">取り下げ理由（必須）</label>
                        <textarea
                          value={cancelReason}
                          onChange={(e) => {
                            setCancelReason(e.target.value);
                            if (cancelError) setCancelError(null);
                          }}
                          rows={3}
                          placeholder="例：人員計画変更のため"
                          className="input-base resize-none md:text-sm"
                        />
                      </div>
                      {cancelError && <p className="text-xs font-medium text-[var(--status-rejected)]">{cancelError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setConfirmCancelMode(false);
                            setCancelReason("");
                            setCancelError(null);
                          }}
                          className="button-secondary flex-1 text-sm"
                        >
                          戻る
                        </button>
                        <button
                          onClick={handleCancelApproved}
                          className="button-primary flex-1 text-sm bg-[var(--status-withdrawn-bg)] text-[var(--status-withdrawn)]"
                        >
                          取り下げを確定
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {isApproved && approvedEditMode && !confirmCancelMode && request.type === "fix" && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">確定内容を編集</p>
                  <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-4 py-4 space-y-3">
                    <div className="max-w-[15rem] space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">日付</label>
                      <input
                        type="date"
                        value={approvedStartDate}
                        onChange={(e) => setApprovedStartDate(e.target.value)}
                        min={DATE_MIN}
                        max={DATE_MAX}
                        className="input-base w-full min-w-0 md:text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">開始時刻</label>
                        <input type="time" step={300} value={approvedStart} onChange={(e) => setApprovedStart(e.target.value)} className="input-base w-full min-w-0 md:text-sm" />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">終了時刻</label>
                        <input type="time" step={300} value={approvedEnd} onChange={(e) => setApprovedEnd(e.target.value)} className="input-base w-full min-w-0 md:text-sm" />
                      </div>
                    </div>
                    {fixDurationError && <p className="text-xs font-medium text-[var(--status-rejected)]">{fixDurationError}</p>}
                    {fixOutsideRequestedWindow && (
                      <div className="rounded-[var(--ds-radius-md)] border border-[var(--status-pending)]/30 bg-[var(--status-pending-bg)]/35 px-3.5 py-2.5">
                        <p className="text-xs font-semibold text-[var(--status-pending)]">申請時間帯をはみ出しています</p>
                        <p className="mt-0.5 text-[11px] text-[var(--on-surface-variant)]">スタッフへ連絡することを推奨します。</p>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">変更理由（申請からズレる場合は必須）</label>
                      <textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} placeholder="例：人員調整のため" className="input-base resize-none md:text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">メッセージ（任意）</label>
                      <p className="text-[11px] text-muted-foreground">スタッフに表示されます</p>
                      <textarea value={reviewerNote} onChange={(e) => setReviewerNote(e.target.value)} rows={2} placeholder="補足メッセージを入力" className="input-base resize-none md:text-sm" />
                    </div>
                  </div>
                  {approvedEditError && <p className="text-xs font-medium text-[var(--status-rejected)]">{approvedEditError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setApprovedEditMode(false); setApprovedEditError(null); }}
                      className="button-secondary flex-1 text-sm"
                    >
                      編集をやめる
                    </button>
                    <button
                      onClick={handleSaveApprovedEdit}
                      disabled={!canSaveApprovedEdit}
                      className={cn(
                        "button-primary flex-1 text-sm",
                        canSaveApprovedEdit ? "" : "bg-muted text-muted-foreground cursor-not-allowed hover:opacity-100"
                      )}
                    >
                      保存する
                    </button>
                  </div>
                </>
              )}

              {isApproved && approvedEditMode && !confirmCancelMode && request.type === "flex" && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">確定内容を編集</p>
                  <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-4 py-4 space-y-3">
                    <div className="max-w-[12.5rem] space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">確定時間数（最大 40時間）</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={partialHours}
                          onChange={(e) => setPartialHours(e.target.value)}
                          min={1}
                          max={40}
                          placeholder="1 〜 40"
                          className="input-base pr-16 text-xl font-semibold tabular-nums"
                          inputMode="decimal"
                        />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--on-surface-variant)]">
                          時間
                        </span>
                      </div>
                    </div>
                    {flexApprovedHoursIncreased && (
                      <div className="rounded-[var(--ds-radius-md)] border border-[var(--status-pending)]/30 bg-[var(--status-pending-bg)]/35 px-3.5 py-2.5">
                        <p className="text-xs font-semibold text-[var(--status-pending)]">申請時間数を上回っています</p>
                        <p className="mt-0.5 text-[11px] text-[var(--on-surface-variant)]">スタッフへ連絡することを推奨します。</p>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">メッセージ（任意）</label>
                      <p className="text-[11px] text-muted-foreground">スタッフに表示されます</p>
                      <textarea value={reviewerNote} onChange={(e) => setReviewerNote(e.target.value)} rows={2} placeholder="補足メッセージを入力" className="input-base resize-none md:text-sm" />
                    </div>
                  </div>
                  {approvedEditError && <p className="text-xs font-medium text-[var(--status-rejected)]">{approvedEditError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setApprovedEditMode(false); setApprovedEditError(null); }}
                      className="button-secondary flex-1 text-sm"
                    >
                      編集をやめる
                    </button>
                    <button
                      onClick={handleSaveApprovedEdit}
                      disabled={!canSaveApprovedEdit}
                      className={cn(
                        "button-primary flex-1 text-sm",
                        canSaveApprovedEdit ? "" : "bg-muted text-muted-foreground cursor-not-allowed hover:opacity-100"
                      )}
                    >
                      保存する
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
    </ShiftRequestModalFrame>
  );
}
