"use client";

import { FixRequest, FlexRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatIsoWeekLabel, formatJstDateTime, formatJstDateTimeRange } from "@/lib/datetime";
import { isProxyRequest } from "@/lib/request-meta";

export function FixDetailRows({ req }: { req: FixRequest }) {
  const hasChange =
    req.approvedStartAt !== undefined &&
    (req.approvedStartAt !== req.requestedStartAt || req.approvedEndAt !== req.requestedEndAt);

  return (
    <>
      <DetailRow label="申請時間帯" value={formatJstDateTimeRange(req.requestedStartAt, req.requestedEndAt)} />
      <DetailRow
        label="申請種別"
        value={isProxyRequest(req) ? (req.createdByName ? `代理申請（${req.createdByName}）` : "代理申請") : "本人申請"}
      />
      {req.note && <DetailRow label="メッセージ" value={req.note} />}

      {req.status === "approved" && req.approvedStartAt && req.approvedEndAt && (
        <div className="section-divider space-y-2">
          <SectionLabel>確定値</SectionLabel>
          {hasChange ? (
            <DetailRow label="確定時間帯" value={formatJstDateTimeRange(req.approvedStartAt, req.approvedEndAt)} />
          ) : (
            <DetailRow
              label="確定時間帯"
              value={`${formatJstDateTimeRange(req.approvedStartAt, req.approvedEndAt)}（申請通り）`}
            />
          )}
          {req.changeReason && <DetailRow label="変更理由" value={req.changeReason} />}
          {req.decisionType && <DecisionBadge type={req.decisionType} />}
        </div>
      )}

      {req.reviewerNote && <DetailRow label="処理メッセージ" value={req.reviewerNote} />}
      {req.reviewedAt && <DetailRow label="処理日時" value={formatJstDateTime(req.reviewedAt)} />}
      {req.reviewedBy && <DetailRow label="処理者" value={req.reviewedByName ?? "不明なユーザー"} />}
      <DetailRow label="申請日時" value={formatJstDateTime(req.createdAt)} />
    </>
  );
}

export function FlexDetailRows({ req }: { req: FlexRequest }) {
  return (
    <>
      <DetailRow label="対象週" value={formatIsoWeekLabel(req.isoYear, req.isoWeek, req.weekStartDate)} />
      <DetailRow
        label="申請種別"
        value={isProxyRequest(req) ? (req.createdByName ? `代理申請（${req.createdByName}）` : "代理申請") : "本人申請"}
      />
      <DetailRow label="申請時間" value={`${req.requestedHours}時間`} />
      {req.note && <DetailRow label="メッセージ" value={req.note} />}

      {req.status === "approved" && req.approvedHours != null && (
        <div className="section-divider space-y-2">
          <SectionLabel>確定値</SectionLabel>
          <DetailRow
            label="承認時間"
            value={req.approvedHours === req.requestedHours ? `${req.approvedHours}時間（申請通り）` : `${req.approvedHours}時間`}
          />
          {req.decisionType && <DecisionBadge type={req.decisionType} />}
        </div>
      )}

      {req.reviewerNote && <DetailRow label="処理メッセージ" value={req.reviewerNote} />}
      {req.reviewedAt && <DetailRow label="処理日時" value={formatJstDateTime(req.reviewedAt)} />}
      {req.reviewedBy && <DetailRow label="処理者" value={req.reviewedByName ?? "不明なユーザー"} />}
      <DetailRow label="申請日時" value={formatJstDateTime(req.createdAt)} />
    </>
  );
}

export function TypeTag({ type }: { type: "fix" | "flex" }) {
  return (
    <span
      className={cn(
        "text-[10px] font-semibold rounded-[var(--ds-radius-pill)] px-2 py-0.5 shrink-0 tracking-wide",
        type === "fix" ? "bg-[var(--surface-container-high)] text-muted-foreground" : "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
      )}
    >
      {type === "fix" ? "FIX" : "FLEX"}
    </span>
  );
}

export function MetaTag({
  kind,
  children,
}: {
  kind: "proxy" | "ok" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    kind === "proxy"
      ? "bg-[var(--surface-container-high)] text-muted-foreground"
      : kind === "ok"
        ? "bg-[var(--status-approved-bg)] text-[var(--status-approved)]"
        : "bg-[var(--status-pending-bg)] text-[var(--status-pending)]";
  return <span className={cn("text-[10px] font-semibold rounded-[var(--ds-radius-pill)] px-2 py-0.5 tracking-wide", cls)}>{children}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{children}</p>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function DecisionBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    approve: "承認",
    partial: "変更承認",
    modify: "変更承認",
    reject: "却下",
  };
  return (
    <span className="text-[11px] font-semibold rounded-[var(--ds-radius-pill)] px-2 py-0.5 tracking-wide bg-[var(--secondary-container)] text-[var(--on-secondary-container)] border border-[var(--outline-variant)]/50">
      {map[type] ?? type}
    </span>
  );
}
