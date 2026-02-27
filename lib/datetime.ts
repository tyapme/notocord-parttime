const DEFAULT_TZ = "Asia/Tokyo";

export function formatYmd(date: Date, timeZone: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatJstDateLabel(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: DEFAULT_TZ,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(d);
  const map: Record<string, string> = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return `${map.month}/${map.day}（${map.weekday}）`;
}

export function formatJstTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: DEFAULT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatJstTimeWithSeconds(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: DEFAULT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatJstDateTimeRange(startIso: string, endIso: string): string {
  const startDate = formatJstDateLabel(startIso);
  const endDate = formatJstDateLabel(endIso);
  const startTime = formatJstTime(startIso);
  const endTime = formatJstTime(endIso);
  if (startDate === endDate) {
    return `${startDate} ${startTime}–${endTime}`;
  }
  return `${startDate} ${startTime} → ${endDate} ${endTime}`;
}

export function formatJstDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: DEFAULT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function combineDateTimeToIso(dateStr: string, timeStr: string, timeZone: string = DEFAULT_TZ): string {
  // Interpret the date/time in the given time zone (default JST) and return UTC ISO string.
  // Append explicit offset for JST to avoid local machine TZ issues.
  if (timeZone === "Asia/Tokyo") {
    return new Date(`${dateStr}T${timeStr}:00+09:00`).toISOString();
  }
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

export function getJstDateValue(iso: string): string {
  const d = new Date(iso);
  return formatYmd(d, DEFAULT_TZ);
}

export function getJstTimeValue(iso: string): string {
  return formatJstTime(iso);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatYmd(d, DEFAULT_TZ);
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  d.setMonth(d.getMonth() + months);
  return formatYmd(d, DEFAULT_TZ);
}

export function parseYmdToDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return null;
  if (formatYmd(d, DEFAULT_TZ) !== dateStr) return null;
  return d;
}

export function isValidYmd(dateStr: string): boolean {
  return parseYmdToDate(dateStr) !== null;
}

export function timeToMinutes(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function diffMinutes(startTime: string, endTime: string): number | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null) return null;
  return end - start;
}

export function formatIsoWeekLabel(isoYear: number, isoWeek: number, weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("ja-JP", { timeZone: DEFAULT_TZ, month: "numeric", day: "numeric" }).format(d);
  return `${fmt(start)}〜${fmt(end)}`;
}

export function getISOWeekNumber(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + "T00:00:00");
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + (4 - (d.getDay() || 7)));
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week = Math.ceil(((thursday.getTime() - jan4.getTime()) / 86400000 + (jan4.getDay() || 7)) / 7);
  return { year, week };
}

export function getISOMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatYmd(d, DEFAULT_TZ);
}

export function buildWeekOptions(rangeWeeksBack = 2, rangeWeeksForward = 5): { monday: string; label: string }[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - rangeWeeksBack * 7);
  const end = new Date(today);
  end.setDate(end.getDate() + rangeWeeksForward * 7);

  const options: { monday: string; label: string }[] = [];
  let cur = new Date(start);
  const day = cur.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  cur.setDate(cur.getDate() + diff);

  while (cur <= end) {
    const monday = formatYmd(cur, DEFAULT_TZ);
    const { year, week } = getISOWeekNumber(monday);
    options.push({ monday, label: formatIsoWeekLabel(year, week, monday) });
    cur.setDate(cur.getDate() + 7);
  }
  return options;
}

export function buildDateOptions(rangeDaysForward = 35): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i <= rangeDaysForward; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const value = formatYmd(d, DEFAULT_TZ);
    options.push({ value, label: formatJstDateLabel(`${value}T00:00:00+09:00`) });
  }
  return options;
}

export function buildTimeOptions(): string[] {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    opts.push(`${String(h).padStart(2, "0")}:00`);
    opts.push(`${String(h).padStart(2, "0")}:30`);
  }
  return opts;
}
