export type Role = "staff" | "reviewer" | "admin";
export type RequestType = "fix" | "flex";
export type Status = "pending" | "approved" | "rejected" | "withdrawn";
export type FixDecisionType = "approve" | "modify" | "reject";
// `partial` is kept for backward compatibility with existing records.
export type FlexDecisionType = "approve" | "modify" | "partial" | "reject";
export type DecisionType = FixDecisionType | FlexDecisionType;

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  requestType: RequestType;
}

export interface FixRequest {
  id: string;
  type: "fix";
  userId: string;
  userName?: string;
  createdBy: string; // userId of creator (self or proxy reviewer/admin)
  createdByName?: string;
  // Requested values
  requestedStartAt: string; // ISO timestamp
  requestedEndAt: string;   // ISO timestamp
  note?: string | null;
  status: Status;
  // Decision
  decisionType?: FixDecisionType;
  // Approved (confirmed) values — may differ from requested when Partial/Modify
  approvedStartAt?: string | null;
  approvedEndAt?: string | null;
  changeReason?: string | null; // required for Modify
  // Meta
  reviewerNote?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface FlexRequest {
  id: string;
  type: "flex";
  userId: string;
  userName?: string;
  createdBy: string;
  createdByName?: string;
  // ISO week
  isoYear: number;
  isoWeek: number;
  weekStartDate: string;  // Monday YYYY-MM-DD
  // Requested / approved hours
  requestedHours: number;
  approvedHours?: number | null;
  note?: string | null;
  status: Status;
  // Decision
  decisionType?: FlexDecisionType;
  reviewerNote?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string;
  reviewedAt?: string | null;
  createdAt: string;
}

export type Request = FixRequest | FlexRequest;

export interface RequestHistoryEntry {
  id: string;
  requestId: string;
  action: "create" | "proxy_create" | "update" | "withdraw" | "review" | "reopen";
  actorId: string | null;
  actorName?: string;
  fromStatus?: Status | null;
  toStatus?: Status | null;
  fromDecisionType?: DecisionType | null;
  toDecisionType?: DecisionType | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}
