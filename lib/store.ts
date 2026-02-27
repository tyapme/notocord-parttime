"use client";

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import {
  User,
  Request,
  FixRequest,
  FlexRequest,
  FixDecisionType,
  DecisionType,
  FlexDecisionType,
  RequestHistoryEntry,
} from "@/lib/types";

type ShiftRequestRow = {
  id: string;
  user_id: string;
  created_by: string;
  type: "fix" | "flex";
  status: "pending" | "approved" | "rejected" | "withdrawn";
  note: string | null;
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_type: string | null;
  change_reason: string | null;
  created_at: string;
  requested_start_at: string | null;
  requested_end_at: string | null;
  approved_start_at: string | null;
  approved_end_at: string | null;
  iso_year: number | null;
  iso_week: number | null;
  week_start_date: string | null;
  requested_hours: number | null;
  approved_hours: number | null;
  user?: { name?: string | null; email?: string | null };
  creator?: { name?: string | null };
  reviewer?: { name?: string | null };
};

type ShiftRequestHistoryRow = {
  id: string;
  request_id: string;
  actor_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  from_decision_type: string | null;
  to_decision_type: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

function parseFixDecisionType(value: string | null): FixDecisionType | undefined {
  if (value === "approve" || value === "modify" || value === "reject") return value;
  return undefined;
}

function parseFlexDecisionType(value: string | null): FlexDecisionType | undefined {
  if (value === "approve" || value === "modify" || value === "partial" || value === "reject") return value;
  return undefined;
}

function parseDecisionType(value: string | null): DecisionType | undefined {
  if (value === "approve" || value === "partial" || value === "modify" || value === "reject") return value;
  return undefined;
}

function parseHistoryAction(value: string): RequestHistoryEntry["action"] | undefined {
  if (
    value === "create" ||
    value === "proxy_create" ||
    value === "update" ||
    value === "withdraw" ||
    value === "review" ||
    value === "reopen"
  ) {
    return value;
  }
  return undefined;
}

function mapProfile(row: any): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    requestType: row.request_type ?? "fix",
  };
}

function mapRequestRow(row: ShiftRequestRow): Request {
  const common = {
    id: row.id,
    userId: row.user_id,
    userName: row.user?.name ?? undefined,
    createdBy: row.created_by,
    createdByName: row.creator?.name ?? undefined,
    status: row.status,
    note: row.note,
    reviewerNote: row.reviewer_note,
    reviewedBy: row.reviewed_by,
    reviewedByName: row.reviewer?.name ?? undefined,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };

  if (row.type === "fix") {
    return {
      ...common,
      type: "fix",
      decisionType: parseFixDecisionType(row.decision_type),
      changeReason: row.change_reason ?? undefined,
      requestedStartAt: row.requested_start_at || "",
      requestedEndAt: row.requested_end_at || "",
      approvedStartAt: row.approved_start_at ?? undefined,
      approvedEndAt: row.approved_end_at ?? undefined,
    };
  }

  const isoYear = row.iso_year || 0;
  const isoWeek = row.iso_week || 0;
  const weekStartDate = row.week_start_date || "";
  return {
    ...common,
    type: "flex",
    decisionType: parseFlexDecisionType(row.decision_type),
    isoYear,
    isoWeek,
    weekStartDate,
    requestedHours: row.requested_hours || 0,
    approvedHours: row.approved_hours ?? undefined,
    // week label is computed in UI when needed
  };
}

function syncRequestUserNames(requests: Request[], users: User[]): Request[] {
  if (!requests.length || !users.length) return requests;
  const nameByUserId = new Map(users.map((u) => [u.id, u.name]));
  return requests.map((req) => {
    const nextUserName = nameByUserId.get(req.userId);
    const nextCreatorName = nameByUserId.get(req.createdBy);
    const nextReviewerName = req.reviewedBy ? nameByUserId.get(req.reviewedBy) : undefined;
    if (
      (!nextUserName || req.userName === nextUserName) &&
      (!nextCreatorName || req.createdByName === nextCreatorName) &&
      (!nextReviewerName || req.reviewedByName === nextReviewerName)
    ) {
      return req;
    }
    return {
      ...req,
      userName: nextUserName ?? req.userName,
      createdByName: nextCreatorName ?? req.createdByName,
      reviewedByName: nextReviewerName ?? req.reviewedByName,
    } as Request;
  });
}

let authSubscription: { unsubscribe: () => void } | null = null;

interface AppState {
  currentUser: User | null;
  session: Session | null;
  users: User[];
  requests: Request[];
  requestHistories: Record<string, RequestHistoryEntry[]>;
  historyLoadingByRequestId: Record<string, boolean>;
  initialized: boolean;
  authLoading: boolean;
  dataLoading: boolean;
  error: string | null;

  init: () => Promise<void>;
  sendSignInCode: (email: string) => Promise<{ ok: boolean; error?: string; challenge?: string; code?: string; expiresAt?: number }>;
  verifySignInCode: (payload: { email: string; code: string; challenge: string }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;

  refresh: () => Promise<void>;
  fetchRequests: () => Promise<void>;
  fetchRequestHistory: (requestId: string) => Promise<void>;
  fetchUsers: () => Promise<void>;

  addFixRequest: (payload: { startAt: string; endAt: string; note?: string }) => Promise<boolean>;
  addFlexRequest: (payload: { dateInWeek: string; requestedHours: number; note?: string }) => Promise<boolean>;
  updateFixRequest: (id: string, payload: { startAt: string; endAt: string; note?: string }) => Promise<boolean>;
  updateFlexRequest: (id: string, payload: { dateInWeek: string; requestedHours: number; note?: string }) => Promise<boolean>;
  reopenFixRequest: (id: string, payload: { startAt: string; endAt: string; note?: string }) => Promise<boolean>;
  reopenFlexRequest: (id: string, payload: { dateInWeek: string; requestedHours: number; note?: string }) => Promise<boolean>;
  withdrawRequest: (id: string, reason: string) => Promise<boolean>;

  reviewFixRequest: (
    id: string,
    payload: {
      decisionType: FixDecisionType;
      approvedStartAt?: string;
      approvedEndAt?: string;
      changeReason?: string;
      reviewerNote?: string;
    }
  ) => Promise<boolean>;
  reviewFlexRequest: (
    id: string,
    payload: {
      decisionType: FlexDecisionType;
      approvedHours?: number;
      reviewerNote?: string;
    }
  ) => Promise<boolean>;
  cancelApprovedRequest: (id: string, reason: string) => Promise<boolean>;

  proxyCreateFix: (payload: { userId: string; startAt: string; endAt: string; note?: string }) => Promise<boolean>;
  proxyCreateFlex: (payload: { userId: string; dateInWeek: string; requestedHours: number; note?: string }) => Promise<boolean>;

  addUser: (payload: { name: string; email: string; role: User["role"]; requestType: User["requestType"] }) => Promise<boolean>;
  updateUser: (id: string, payload: { name: string; email: string; role: User["role"]; requestType: User["requestType"] }) => Promise<boolean>;
  toggleActiveUser: (id: string, active: boolean) => Promise<boolean>;
}

export const useAppStore = create<AppState>()((set, get) => ({
  currentUser: null,
  session: null,
  users: [],
  requests: [],
  requestHistories: {},
  historyLoadingByRequestId: {},
  initialized: false,
  authLoading: true,
  dataLoading: false,
  error: null,

  init: async () => {
    if (get().initialized) return;
    set({ initialized: true, authLoading: true, error: null });

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session ?? null;
    set({ session });

    if (session) {
      await loadProfileAndData(set, get, session);
    } else {
      set({ currentUser: null, users: [], requests: [], requestHistories: {}, historyLoadingByRequestId: {} });
    }
    set({ authLoading: false });

    if (!authSubscription) {
      const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        set({ session: newSession ?? null, authLoading: true });
        if (newSession) {
          await loadProfileAndData(set, get, newSession);
        } else {
          set({ currentUser: null, users: [], requests: [], requestHistories: {}, historyLoadingByRequestId: {} });
        }
        set({ authLoading: false });
      });
      authSubscription = data.subscription;
    }
  },

  sendSignInCode: async (email: string) => {
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data?.error || "認証コードの発行に失敗しました" };
      }
      return {
        ok: true,
        challenge: data?.challenge,
        code: data?.code,
        expiresAt: data?.expiresAt,
      };
    } catch (err) {
      return { ok: false, error: "認証コードの発行に失敗しました" };
    }
  },

  verifySignInCode: async ({ email, code, challenge }) => {
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, challenge }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data?.error || "サインインに失敗しました" };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "サインインに失敗しました" };
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ currentUser: null, session: null, users: [], requests: [], requestHistories: {}, historyLoadingByRequestId: {} });
  },

  refresh: async () => {
    await Promise.all([get().fetchRequests(), get().fetchUsers()]);
  },

  fetchRequests: async () => {
    if (!get().session) {
      set({ requests: [], requestHistories: {}, historyLoadingByRequestId: {} });
      return;
    }
    set({ dataLoading: true });
    const { data, error } = await supabase
      .from("shift_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      set({ dataLoading: false, error: error.message });
      return;
    }
    const rows = (data || []) as ShiftRequestRow[];
    const userIds = Array.from(
      new Set(
        rows
          .flatMap((r) => [r.user_id, r.created_by, r.reviewed_by])
          .filter((id): id is string => Boolean(id))
      )
    );
    const userMap = new Map<string, { name: string | null; email: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", userIds);
      if (!profilesError && profiles) {
        for (const p of profiles as Array<{ id: string; name: string | null; email: string | null }>) {
          userMap.set(p.id, { name: p.name, email: p.email });
        }
      }
    }

    const mapped = rows.map((row) => {
      const user = userMap.get(row.user_id);
      const creator = userMap.get(row.created_by);
      const reviewer = row.reviewed_by ? userMap.get(row.reviewed_by) : undefined;
      return mapRequestRow({
        ...row,
        user: user ? { name: user.name, email: user.email } : undefined,
        creator: creator ? { name: creator.name } : undefined,
        reviewer: reviewer ? { name: reviewer.name } : undefined,
      });
    });
    const synced = syncRequestUserNames(mapped, get().users);
    set({ requests: synced, dataLoading: false, error: null, requestHistories: {}, historyLoadingByRequestId: {} });
  },

  fetchRequestHistory: async (requestId) => {
    if (!get().session || !requestId) return;
    set((state) => ({
      historyLoadingByRequestId: {
        ...state.historyLoadingByRequestId,
        [requestId]: true,
      },
    }));

    const { data, error } = await supabase
      .from("shift_request_histories")
      .select("id,request_id,actor_id,action,from_status,to_status,from_decision_type,to_decision_type,details,created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });

    if (error) {
      set((state) => ({
        historyLoadingByRequestId: {
          ...state.historyLoadingByRequestId,
          [requestId]: false,
        },
        error: error.message,
      }));
      return;
    }

    const rows = (data || []) as ShiftRequestHistoryRow[];
    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id))));
    const actorNameById = new Map<string, string>();

    if (actorIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id,name")
        .in("id", actorIds);
      if (!profilesError && profiles) {
        for (const p of profiles as Array<{ id: string; name: string | null }>) {
          actorNameById.set(p.id, p.name ?? p.id);
        }
      }
    }

    const mapped: RequestHistoryEntry[] = [];
    for (const row of rows) {
      const action = parseHistoryAction(row.action);
      if (!action) continue;
      mapped.push({
        id: row.id,
        requestId: row.request_id,
        action,
        actorId: row.actor_id,
        actorName: row.actor_id ? actorNameById.get(row.actor_id) : undefined,
        fromStatus: (row.from_status as RequestHistoryEntry["fromStatus"]) ?? null,
        toStatus: (row.to_status as RequestHistoryEntry["toStatus"]) ?? null,
        fromDecisionType: parseDecisionType(row.from_decision_type) ?? null,
        toDecisionType: parseDecisionType(row.to_decision_type) ?? null,
        details: row.details ?? null,
        createdAt: row.created_at,
      });
    }

    set((state) => ({
      requestHistories: {
        ...state.requestHistories,
        [requestId]: mapped,
      },
      historyLoadingByRequestId: {
        ...state.historyLoadingByRequestId,
        [requestId]: false,
      },
      error: null,
    }));
  },

  fetchUsers: async () => {
    const role = get().currentUser?.role;
    if (!role || role === "staff") {
      set({ users: [] });
      return;
    }
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) {
      set({ error: error.message });
      return;
    }
    const users = (data || []).map(mapProfile);
    set((state) => ({
      users,
      requests: syncRequestUserNames(state.requests, users),
    }));
  },

  addFixRequest: async ({ startAt, endAt, note }) => {
    const { error } = await supabase.rpc("request_fix", {
      start_at: startAt,
      end_at: endAt,
      note: note ?? null,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  addFlexRequest: async ({ dateInWeek, requestedHours, note }) => {
    const { error } = await supabase.rpc("request_flex", {
      date_in_week: dateInWeek,
      requested_hours: requestedHours,
      note: note ?? null,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  updateFixRequest: async (id, { startAt, endAt, note }) => {
    const { error } = await supabase.rpc("update_fix_request", {
      request_id: id,
      start_at: startAt,
      end_at: endAt,
      p_note: note ?? null,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  updateFlexRequest: async (id, { dateInWeek, requestedHours, note }) => {
    const { error } = await supabase.rpc("update_flex_request", {
      request_id: id,
      date_in_week: dateInWeek,
      p_requested_hours: requestedHours,
      p_note: note ?? null,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  reopenFixRequest: async (id, { startAt, endAt, note }) => {
    const { error } = await supabase.rpc("reopen_fix_request", {
      request_id: id,
      start_at: startAt,
      end_at: endAt,
      p_note: note ?? null,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  reopenFlexRequest: async (id, { dateInWeek, requestedHours, note }) => {
    const { error } = await supabase.rpc("reopen_flex_request", {
      request_id: id,
      date_in_week: dateInWeek,
      p_requested_hours: requestedHours,
      p_note: note ?? null,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  withdrawRequest: async (id, reason) => {
    const target = get().requests.find((r) => r.id === id);
    const rpcName = target?.status === "approved" ? "cancel_approved_request" : "withdraw_request";
    const { error } = await supabase.rpc(rpcName, {
      request_id: id,
      p_reason: reason,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  reviewFixRequest: async (id, payload) => {
    const { error } = await supabase.rpc("review_fix_request", {
      request_id: id,
      p_decision_type: payload.decisionType,
      p_approved_start_at: payload.approvedStartAt ?? null,
      p_approved_end_at: payload.approvedEndAt ?? null,
      p_change_reason: payload.changeReason ?? null,
      p_reviewer_note: payload.reviewerNote ?? null,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  reviewFlexRequest: async (id, payload) => {
    const { error } = await supabase.rpc("review_flex_request", {
      request_id: id,
      p_decision_type: payload.decisionType,
      p_approved_hours: payload.approvedHours ?? null,
      p_reviewer_note: payload.reviewerNote ?? null,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  cancelApprovedRequest: async (id, reason) => {
    const { error } = await supabase.rpc("cancel_approved_request", {
      request_id: id,
      p_reason: reason,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  proxyCreateFix: async ({ userId, startAt, endAt, note }) => {
    const { error } = await supabase.rpc("proxy_create_fix_request", {
      user_id: userId,
      start_at: startAt,
      end_at: endAt,
      note: note ?? null,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  proxyCreateFlex: async ({ userId, dateInWeek, requestedHours, note }) => {
    const { error } = await supabase.rpc("proxy_create_flex_request", {
      user_id: userId,
      date_in_week: dateInWeek,
      requested_hours: requestedHours,
      note: note ?? null,
    });
    if (error) {
      set({ error: error.message });
      return false;
    }
    await get().fetchRequests();
    return true;
  },

  addUser: async (payload) => {
    const token = get().session?.access_token;
    if (!token) return false;
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      set({ error: data?.error || "作成に失敗しました" });
      return false;
    }
    await get().fetchUsers();
    return true;
  },

  updateUser: async (id, payload) => {
    const token = get().session?.access_token;
    if (!token) return false;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...payload }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      set({ error: data?.error || "更新に失敗しました" });
      return false;
    }
    await get().fetchUsers();
    return true;
  },

  toggleActiveUser: async (id, active) => {
    const token = get().session?.access_token;
    if (!token) return false;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      set({ error: data?.error || "更新に失敗しました" });
      return false;
    }
    await get().fetchUsers();
    return true;
  },
}));

async function loadProfileAndData(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  session: Session
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error || !profile) {
    set({ currentUser: null, users: [], requests: [], requestHistories: {}, historyLoadingByRequestId: {} });
    return;
  }
  if (!profile.active) {
    await supabase.auth.signOut();
    set({ currentUser: null, users: [], requests: [], requestHistories: {}, historyLoadingByRequestId: {} });
    return;
  }
  set({ currentUser: mapProfile(profile) });
  await get().refresh();
}
