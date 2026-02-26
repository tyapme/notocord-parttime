import { addDays, formatYmd, getJstDateValue } from "@/lib/datetime";
import { Request } from "@/lib/types";

export function isNearTermShiftRequest(
  request: Request,
  days: number = 2,
  todayYmd: string = formatYmd(new Date())
): boolean {
  const thresholdYmd = addDays(todayYmd, days);

  if (request.type === "fix") {
    const baseStart = request.approvedStartAt ?? request.requestedStartAt;
    const workDateYmd = getJstDateValue(baseStart);
    return workDateYmd >= todayYmd && workDateYmd <= thresholdYmd;
  }

  const weekStart = request.weekStartDate;
  const weekEnd = addDays(weekStart, 6);
  return weekEnd >= todayYmd && weekStart <= thresholdYmd;
}
