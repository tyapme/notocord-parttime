import { FixRequest, FlexRequest, Request } from "@/lib/types";

export function isProxyRequest(request: Request): boolean {
  return request.createdBy !== request.userId;
}

function isFixFullyApproved(request: FixRequest): boolean {
  if (!request.approvedStartAt || !request.approvedEndAt) return false;
  return (
    request.approvedStartAt === request.requestedStartAt &&
    request.approvedEndAt === request.requestedEndAt
  );
}

function isFlexFullyApproved(request: FlexRequest): boolean {
  if (request.approvedHours == null) return false;
  return request.approvedHours === request.requestedHours;
}

export function getApprovalSummary(
  request: Request
): { label: string; tone: "full" | "adjusted" } | null {
  if (request.status !== "approved") return null;

  if (request.decisionType === "approve") {
    return { label: "申請通り承認", tone: "full" };
  }
  if (request.decisionType === "partial" || request.decisionType === "modify") {
    return { label: "調整して承認", tone: "adjusted" };
  }

  if (request.type === "fix" && isFixFullyApproved(request)) {
    return { label: "申請通り承認", tone: "full" };
  }
  if (request.type === "flex" && isFlexFullyApproved(request)) {
    return { label: "申請通り承認", tone: "full" };
  }
  return { label: "調整して承認", tone: "adjusted" };
}

export function formatFlexRequestVsApproved(request: FlexRequest): string {
  if (request.approvedHours == null) {
    return `申請 ${request.requestedHours}時間`;
  }
  if (request.approvedHours === request.requestedHours) {
    return `申請 ${request.requestedHours}時間 / 確定 ${request.approvedHours}時間（申請通り）`;
  }
  return `申請 ${request.requestedHours}時間 / 確定 ${request.approvedHours}時間（調整）`;
}
