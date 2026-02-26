import { addDays, formatYmd, getJstDateValue, parseYmdToDate } from "@/lib/datetime";
import { Request } from "@/lib/types";

export function getRequestWorkDate(request: Request): string {
  if (request.type === "fix") {
    return getJstDateValue(request.requestedStartAt);
  }
  return request.weekStartDate;
}

export function isPastRequest(request: Request, todayYmd: string = formatYmd(new Date())): boolean {
  if (request.type === "fix") {
    return getJstDateValue(request.requestedStartAt) < todayYmd;
  }
  const weekEnd = addDays(request.weekStartDate, 6);
  return weekEnd < todayYmd;
}

function getPastAnchorDate(request: Request): string {
  if (request.type === "fix") {
    return getJstDateValue(request.requestedStartAt);
  }
  return addDays(request.weekStartDate, 6);
}

export function shouldShowRecentUnapprovedPast(
  request: Request,
  days: number = 7,
  todayYmd: string = formatYmd(new Date())
): boolean {
  if (request.status !== "pending") return false;
  if (!isPastRequest(request, todayYmd)) return false;

  const today = parseYmdToDate(todayYmd);
  const anchor = parseYmdToDate(getPastAnchorDate(request));
  if (!today || !anchor) return false;

  const diffDays = Math.floor((today.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays <= days;
}

export function sortRequestsByWorkDateNearest(
  requests: Request[],
  todayYmd: string = formatYmd(new Date())
): Request[] {
  return [...requests].sort((a, b) => {
    const aPast = isPastRequest(a, todayYmd);
    const bPast = isPastRequest(b, todayYmd);
    if (aPast !== bPast) return aPast ? 1 : -1;

    const aDate = getRequestWorkDate(a);
    const bDate = getRequestWorkDate(b);

    if (aPast) {
      if (aDate !== bDate) return bDate.localeCompare(aDate);
    } else {
      if (aDate !== bDate) return aDate.localeCompare(bDate);
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
