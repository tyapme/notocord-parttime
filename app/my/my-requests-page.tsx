"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { FixRequest, FlexRequest, Request } from "@/lib/types";
import {
  formatIsoWeekLabel,
  formatJstDateLabel,
  formatJstTime,
} from "@/lib/datetime";
import {
  isPastRequest,
  shouldShowRecentUnapprovedPast,
  sortRequestsByWorkDateNearest,
} from "@/lib/request-list";
import { formatFlexRequestVsApproved, getApprovalSummary, isProxyRequest } from "@/lib/request-meta";
import { MetaTag, TypeTag } from "./request-detail-sections";
import { ChevronRight } from "lucide-react";
import { StaffRequestModal } from "@/components/staff-request-modal";

export function MyRequestsScreen({ onNewRequest }: { onNewRequest: () => void }) {
  const currentUser = useAppStore((s) => s.currentUser);
  const currentUserId = currentUser?.id ?? "";
  const requests = useAppStore((s) => s.requests);
  const fetchRequests = useAppStore((s) => s.fetchRequests);
  const globalError = useAppStore((s) => s.error);

  const [selected, setSelected] = useState<Request | null>(null);
  const [listTab, setListTab] = useState<"all" | "approved">("all");
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const myRequests = sortRequestsByWorkDateNearest(
    requests.filter((r) => r.userId === currentUserId)
  );

  const tabFiltered = listTab === "approved"
    ? myRequests.filter((r) => r.status === "approved")
    : myRequests;
  const hiddenPastCount = tabFiltered.filter(
    (r) => isPastRequest(r) && !(listTab === "all" && shouldShowRecentUnapprovedPast(r, 7))
  ).length;
  const filtered = showPast
    ? tabFiltered
    : tabFiltered.filter(
      (r) => !isPastRequest(r) || (listTab === "all" && shouldShowRecentUnapprovedPast(r, 7))
    );

  if (!currentUser) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">申請一覧</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{myRequests.length}件</p>
        </div>
        <button
          onClick={onNewRequest}
          className="button-primary px-4 text-sm"
        >
          申請する
        </button>
      </div>

      {globalError && (
        <div className="mb-4 rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-[var(--status-rejected-bg)]/40 px-4 py-3 text-xs text-[var(--status-rejected)]">
          取得に失敗しました: {globalError}
        </div>
      )}

      <div className="flex gap-1 p-1 bg-[var(--surface-container)] rounded-[var(--ds-radius-pill)] mb-5 w-fit">
        {(["all", "approved"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setListTab(t)}
            className={cn(
              "rounded-[var(--ds-radius-pill)] px-4 py-1.5 text-sm font-medium transition-colors",
              listTab === t ? "bg-[var(--surface-container-lowest)] text-foreground shadow-[var(--ds-elevation-card)]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "all" ? "すべて" : "確定"}
          </button>
        ))}
      </div>

      {(hiddenPastCount > 0 || showPast) && (
        <div className="mb-4">
          <button
            onClick={() => setShowPast((v) => !v)}
            className="button-secondary px-3 text-xs text-muted-foreground"
          >
            {showPast ? "過去の申請を隠す" : `過去の申請を表示（${hiddenPastCount}件）`}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-sm text-muted-foreground">申請はまだありません</p>
          <button
            onClick={onNewRequest}
            className="button-primary mt-4 px-5 text-sm"
          >
            最初の申請をする
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => {
            const approval = getApprovalSummary(req);
            const isProxy = isProxyRequest(req);
            return (
              <button
                key={req.id}
                onClick={() => setSelected(req)}
                className="surface-card-subtle motion-scale-hover w-full flex items-center justify-between gap-3 px-4 py-4 text-left group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <TypeTag type={req.type} />
                    {isProxy && (
                      <MetaTag kind="proxy">
                        {req.createdByName ? `代理申請（${req.createdByName}）` : "代理申請"}
                      </MetaTag>
                    )}
                    {approval && (
                      <MetaTag kind={approval.tone === "full" ? "ok" : "warn"}>
                        {approval.label}
                      </MetaTag>
                    )}
                    <span className="text-sm font-semibold text-foreground">
                      {req.type === "fix"
                        ? formatJstDateLabel((req as FixRequest).requestedStartAt)
                        : formatIsoWeekLabel((req as FlexRequest).isoYear, (req as FlexRequest).isoWeek, (req as FlexRequest).weekStartDate)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-0.5">
                    {req.type === "fix"
                      ? `${formatJstTime((req as FixRequest).requestedStartAt)} – ${formatJstTime((req as FixRequest).requestedEndAt)}`
                      : formatFlexRequestVsApproved(req as FlexRequest)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={req.status} />
                  <ChevronRight className="text-foreground/80 group-hover:text-foreground transition-colors" style={{ width: 24, height: 24 }} strokeWidth={2.8} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ===== Detail modal ===== */}
      {selected && (
        <StaffRequestModal
          request={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
