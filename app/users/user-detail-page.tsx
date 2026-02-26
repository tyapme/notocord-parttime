"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { FixRequest, FlexRequest, Request, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { ListCardSkeleton } from "@/components/loading-skeletons";
import {
  formatIsoWeekLabel,
  formatJstDateLabel,
  formatJstDateTime,
  formatJstTime,
} from "@/lib/datetime";
import { sortRequestsByWorkDateNearest } from "@/lib/request-list";
import { getApprovalSummary, isProxyRequest } from "@/lib/request-meta";
import { ReviewRequestModal } from "@/app/review/review-request-modal";
import { MetaTag, TypeTag } from "@/components/shift-request-ui";
import { ChevronRight } from "lucide-react";

const ROLE_LABELS: Record<User["role"], string> = {
  staff: "アルバイト",
  reviewer: "レビュアー",
  admin: "管理者",
};

export function UsersDetailScreen() {
  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const requests = useAppStore((s) => s.requests);
  const fetchUsers = useAppStore((s) => s.fetchUsers);
  const fetchRequests = useAppStore((s) => s.fetchRequests);

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchUsers(), fetchRequests()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchUsers, fetchRequests]);

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => u.active && u.role === "staff")
      .filter((u) => {
        if (!q) return true;
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }, [users, query]);

  useEffect(() => {
    if (!visibleUsers.length) {
      setSelectedUserId("");
      return;
    }
    if (!selectedUserId || !visibleUsers.some((u) => u.id === selectedUserId)) {
      setSelectedUserId(visibleUsers[0].id);
    }
  }, [visibleUsers, selectedUserId]);

  useEffect(() => {
    setSelectedRequest(null);
  }, [selectedUserId]);

  const selectedUser =
    visibleUsers.find((u) => u.id === selectedUserId) ||
    users.find((u) => u.id === selectedUserId) ||
    null;

  const userRequests = useMemo(() => {
    if (!selectedUser) return [] as Request[];
    return sortRequestsByWorkDateNearest(requests.filter((r) => r.userId === selectedUser.id));
  }, [requests, selectedUser]);

  const pendingCount = useMemo(
    () => userRequests.filter((req) => req.status === "pending").length,
    [userRequests]
  );

  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "reviewer")) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="page-title">ユーザー詳細</h1>
        <p className="text-xs text-muted-foreground mt-0.5">アルバイトごとの申請状況を確認できます</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <aside className="surface-card p-3 h-fit">
          <div className="space-y-2 mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="名前・メールで検索"
              className="input-base h-9 text-sm"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              <ListCardSkeleton rows={3} />
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
              対象ユーザーがいません。
            </div>
          ) : (
            <div className="space-y-1">
              {visibleUsers.map((u) => {
                const isActive = selectedUserId === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                      isActive
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {u.requestType.toUpperCase()}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="space-y-3">
          {!selectedUser ? (
            <div className="surface-card px-4 py-8 text-sm text-muted-foreground">
              ユーザーを選択してください。
            </div>
          ) : (
            <>
              <div className="surface-card px-4 py-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-foreground">{selectedUser.name}</h2>
                  <span className="text-[11px] font-bold rounded-md px-2 py-0.5 bg-muted text-muted-foreground">
                    {ROLE_LABELS[selectedUser.role]}
                  </span>
                  <span className="text-[11px] font-bold rounded-md px-2 py-0.5 bg-primary/10 text-primary">
                    {selectedUser.requestType.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{selectedUser.email}</p>
              </div>

              <div
                className={cn(
                  "rounded-[var(--ds-radius-lg)] border px-4 py-3",
                  pendingCount > 0
                    ? "border-amber-300 bg-amber-50/80"
                    : "border-border bg-muted/30"
                )}
              >
                <p className="text-xs font-semibold text-muted-foreground">承認待ち</p>
                <p
                  className={cn(
                    "text-2xl font-semibold leading-none mt-1",
                    pendingCount > 0 ? "text-amber-700" : "text-foreground"
                  )}
                >
                  {pendingCount}件
                </p>
                {pendingCount > 0 && (
                  <p className="text-xs font-medium text-amber-700 mt-1">対応が必要です</p>
                )}
              </div>

              <div className="surface-card p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground">申請一覧</h3>
                </div>
                {userRequests.length === 0 ? (
                  <div className="rounded-[var(--ds-radius-md)] border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                    申請データがありません。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {userRequests.map((req) => {
                      const approval = getApprovalSummary(req);
                      const isFlex = req.type === "flex";
                      const flexReq = isFlex ? (req as FlexRequest) : null;
                      const fixReq = isFlex ? null : (req as FixRequest);
                      const fixStart = fixReq
                        ? req.status === "approved" && fixReq.approvedStartAt
                          ? fixReq.approvedStartAt
                          : fixReq.requestedStartAt
                        : null;
                      const fixEnd = fixReq
                        ? req.status === "approved" && fixReq.approvedEndAt
                          ? fixReq.approvedEndAt
                          : fixReq.requestedEndAt
                        : null;
                      const periodLabel = isFlex && flexReq
                        ? formatIsoWeekLabel(flexReq.isoYear, flexReq.isoWeek, flexReq.weekStartDate)
                        : fixStart && fixEnd
                          ? `${formatJstDateLabel(fixStart)}${formatJstDateLabel(fixStart) !== formatJstDateLabel(fixEnd) ? ` → ${formatJstDateLabel(fixEnd)}` : ""}`
                          : "";
                      const hoursLabel = isFlex && flexReq
                        ? getFlexHoursLabel(flexReq)
                        : fixStart && fixEnd
                          ? `${req.status === "approved" ? "確定" : "申請"} ${formatJstTime(fixStart)}–${formatJstTime(fixEnd)}`
                          : "";
                      return (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => setSelectedRequest(req)}
                          className="w-full rounded-[var(--ds-radius-md)] border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted/30 group"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <TypeTag type={req.type} />
                              <StatusBadge status={req.status} />
                              {isProxyRequest(req) && (
                                <MetaTag kind="proxy">
                                  {req.createdByName ? `代理（${req.createdByName}）` : "代理"}
                                </MetaTag>
                              )}
                              {approval && (
                                <MetaTag kind={approval.tone === "full" ? "ok" : "warn"}>
                                  {approval.label}
                                </MetaTag>
                              )}
                            </div>
                            <ChevronRight
                              className="shrink-0 text-foreground/80 transition-colors group-hover:text-foreground"
                              style={{ width: 24, height: 24 }}
                              strokeWidth={2.8}
                            />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{periodLabel}</p>
                          <p className="mt-1 text-base font-bold tabular-nums text-foreground">{hoursLabel}</p>
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            申請日時: {formatJstDateTime(req.createdAt)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {selectedRequest && (
        <ReviewRequestModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
}

function getFlexHoursLabel(request: FlexRequest): string {
  if (request.status === "approved" && request.approvedHours != null) {
    return `確定 ${request.approvedHours}時間`;
  }
  return `申請 ${request.requestedHours}時間`;
}
