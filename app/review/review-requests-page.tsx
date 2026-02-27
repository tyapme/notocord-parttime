"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { StatusBadge } from "@/components/status-badge";
import { FixRequest, FlexRequest, Request } from "@/lib/types";
import { cn } from "@/lib/utils";
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
import { MetaTag, TypeTag } from "./review-modal-sections";
import { ReviewRequestModal } from "./review-request-modal";
import { ChevronRight } from "lucide-react";

type ListTab = "pending" | "all";

// ---- Main component ----
export function ReviewScreen() {
  const requests = useAppStore((s) => s.requests);

  const [listTab, setListTab] = useState<ListTab>("pending");
  const [showPast, setShowPast] = useState(false);
  const [selected, setSelected] = useState<Request | null>(null);
  const [query, setQuery] = useState("");

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const tabFiltered = requests
    .filter((r) => listTab === "pending" ? r.status === "pending" : true)
    .filter((r) => {
      if (listTab !== "all") return true;
      if (query.trim()) {
        const name = (r.userName ?? "").toLowerCase();
        if (!name.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });

  const sorted = sortRequestsByWorkDateNearest(tabFiltered);
  const keepRecentPastPending = listTab === "all" || listTab === "pending";
  const hiddenPastCount = sorted.filter(
    (r) => isPastRequest(r) && !(keepRecentPastPending && shouldShowRecentUnapprovedPast(r, 7))
  ).length;
  const filtered = showPast
    ? sorted
    : sorted.filter(
      (r) => !isPastRequest(r) || (keepRecentPastPending && shouldShowRecentUnapprovedPast(r, 7))
    );

  const closeModal = () => {
    setSelected(null);
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="page-title">承認</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {pendingCount > 0 ? `${pendingCount}件の承認待ち` : "承認待ちなし"}
        </p>
      </div>

      {/* List tab */}
      <div className="flex gap-1 p-1 bg-[var(--surface-container)] rounded-[var(--ds-radius-pill)] mb-5 w-fit">
        {(["pending", "all"] as ListTab[]).map((t) => (
          <button key={t} onClick={() => setListTab(t)}
            className={cn(
              "rounded-[var(--ds-radius-pill)] px-4 py-1.5 text-sm font-medium transition-colors",
              listTab === t ? "bg-[var(--surface-container-lowest)] text-foreground shadow-[var(--ds-elevation-card)]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "pending" ? `承認待ち${pendingCount > 0 ? ` (${pendingCount})` : ""}` : "すべて"}
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

      {listTab === "all" && (
        <div className="mb-5">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="アルバイト名で検索"
              className="input-base"
            />
            {query.trim().length > 0 && (
              <button
                onClick={() => setQuery("")}
                className="button-secondary px-3 text-xs whitespace-nowrap"
              >
                クリア
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-sm text-muted-foreground">
            {listTab === "pending" ? "承認待ちの申請はありません" : "申請がありません"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => {
            const approval = getApprovalSummary(req);
            const isProxy = isProxyRequest(req);
            return (
              <button key={req.id} onClick={() => setSelected(req)}
                className="surface-card-subtle motion-scale-hover w-full flex items-center justify-between gap-3 px-4 py-4 text-left group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{req.userName ?? "不明"}</span>
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
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {req.type === "fix"
                      ? `${formatJstDateLabel((req as FixRequest).requestedStartAt)}  ${formatJstTime((req as FixRequest).requestedStartAt)}–${formatJstTime((req as FixRequest).requestedEndAt)}`
                      : `${formatIsoWeekLabel((req as FlexRequest).isoYear, (req as FlexRequest).isoWeek, (req as FlexRequest).weekStartDate)}  ·  ${formatFlexRequestVsApproved(req as FlexRequest)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={req.status} />
                  <ChevronRight
                    className="text-foreground/80 group-hover:text-foreground transition-colors shrink-0"
                    style={{ width: 24, height: 24 }}
                    strokeWidth={2.8}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ReviewRequestModal
          request={selected}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
