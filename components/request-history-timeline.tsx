"use client";

import { formatJstDateTime, formatJstDateTimeRange } from "@/lib/datetime";
import { RequestHistoryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<RequestHistoryEntry["action"], string> = {
  create: "申請作成",
  proxy_create: "代理作成",
  update: "申請編集",
  withdraw: "取り下げ",
  review: "承認処理",
  reopen: "キャンセル",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
  withdrawn: "取り下げ",
};

const DECISION_LABEL: Record<string, string> = {
  approve: "承認",
  partial: "変更承認",
  modify: "変更承認",
  reject: "却下",
};

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function buildDetailLines(entry: RequestHistoryEntry): string[] {
  const details = entry.details ?? {};
  const lines: string[] = [];

  const reason = asString(details.change_reason);
  if (reason) lines.push(`変更理由: ${reason}`);

  const cancelReason = asString(details.cancel_reason);
  if (cancelReason) lines.push(`キャンセル理由: ${cancelReason}`);

  const reviewerNote = asString(details.reviewer_note);
  if (reviewerNote) lines.push(`メッセージ: ${reviewerNote}`);

  const noteAfter = asString(details.after_note);
  if (noteAfter) lines.push(`メッセージ: ${noteAfter}`);

  const approvedStart = asString(details.approved_start_at);
  const approvedEnd = asString(details.approved_end_at);
  if (approvedStart && approvedEnd) {
    lines.push(`確定時間: ${formatJstDateTimeRange(approvedStart, approvedEnd)}`);
  }

  const approvedHours = asNumber(details.approved_hours);
  if (approvedHours !== undefined) {
    lines.push(`確定時間数: ${approvedHours}時間`);
  }

  const beforeStart = asString(details.before_requested_start_at);
  const beforeEnd = asString(details.before_requested_end_at);
  const afterStart = asString(details.after_requested_start_at);
  const afterEnd = asString(details.after_requested_end_at);
  if (beforeStart && beforeEnd && afterStart && afterEnd) {
    const before = formatJstDateTimeRange(beforeStart, beforeEnd);
    const after = formatJstDateTimeRange(afterStart, afterEnd);
    if (before !== after) lines.push(`申請時間: ${before} → ${after}`);
  }

  const beforeHours = asNumber(details.before_requested_hours);
  const afterHours = asNumber(details.after_requested_hours);
  if (beforeHours !== undefined && afterHours !== undefined && beforeHours !== afterHours) {
    lines.push(`申請時間数: ${beforeHours}時間 → ${afterHours}時間`);
  }

  return lines;
}

export function RequestHistoryTimeline({
  entries,
  loading,
}: {
  entries: RequestHistoryEntry[];
  loading?: boolean;
}) {
  return (
    <div className="section-divider space-y-2">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">変更履歴</p>
      {loading ? (
        <p className="text-xs text-muted-foreground">履歴を読み込み中...</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">履歴はありません。</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const statusChanged = entry.fromStatus !== entry.toStatus && !!entry.toStatus;
            const decisionChanged = entry.fromDecisionType !== entry.toDecisionType && !!entry.toDecisionType;
            const lines = buildDetailLines(entry);
            return (
              <div key={entry.id} className="rounded-[var(--ds-radius-md)] border border-border bg-card px-3 py-2.5 shadow-[0_1px_1px_rgba(15,23,42,.03)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-foreground">{ACTION_LABEL[entry.action]}</span>
                  <span className="text-[11px] text-muted-foreground">{formatJstDateTime(entry.createdAt)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  実行者: {entry.actorName ?? entry.actorId ?? "システム"}
                </p>
                {statusChanged && (
                  <p className="text-[11px] mt-1 text-foreground">
                    状態: {STATUS_LABEL[entry.fromStatus ?? ""] ?? entry.fromStatus ?? "-"} →{" "}
                    <span className="font-semibold">{STATUS_LABEL[entry.toStatus ?? ""] ?? entry.toStatus}</span>
                  </p>
                )}
                {decisionChanged && (
                  <p className="text-[11px] mt-0.5 text-foreground">
                    判定: {DECISION_LABEL[entry.fromDecisionType ?? ""] ?? entry.fromDecisionType ?? "-"} →{" "}
                    <span className={cn("font-semibold")}>
                      {DECISION_LABEL[entry.toDecisionType ?? ""] ?? entry.toDecisionType}
                    </span>
                  </p>
                )}
                {lines.map((line, idx) => (
                  <p key={`${entry.id}-${idx}`} className="text-[11px] mt-0.5 text-muted-foreground">
                    {line}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
