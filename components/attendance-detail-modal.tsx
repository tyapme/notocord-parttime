"use client";

import { useEffect } from "react";
import { Clock3, Coffee, Play, CheckCircle2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttendanceSessionDb, getWorkMinutesDb, getBreakMinutesDb } from "@/lib/attendance-db";
import { useIsMobile } from "@/hooks/use-mobile";

interface AttendanceDetailModalProps {
  session: AttendanceSessionDb;
  onClose: () => void;
  hourlyRate?: number;
}

export function AttendanceDetailModal({ session, onClose, hourlyRate = 0 }: AttendanceDetailModalProps) {
  const isMobile = useIsMobile();
  const clockIn = new Date(session.start_at);
  const clockOut = session.end_at ? new Date(session.end_at) : null;
  const workMin = getWorkMinutesDb(session);
  const breakMin = getBreakMinutesDb(session);
  const estimatedPay = hourlyRate > 0 ? Math.floor((workMin / 60) * hourlyRate) : 0;

  const formatTime = (date: Date) =>
    `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    return `${year}/${month}/${day}（${weekday}）`;
  };

  // 休憩情報をパース
  const breaks: { start: Date; end: Date | null }[] = [];
  if (session.breaks && Array.isArray(session.breaks)) {
    for (const b of session.breaks) {
      if (b && typeof b === "object" && "start_at" in b) {
        breaks.push({
          start: new Date(b.start_at as string),
          end: b.end_at ? new Date(b.end_at as string) : null,
        });
      }
    }
  }

  // Escキーで閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // モバイル: ドロワー / デスクトップ: モーダル
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="閉じる"
      />

      <div
        className={cn(
          "relative bg-card shadow-2xl flex flex-col overflow-hidden",
          isMobile
            ? "w-full max-h-[90vh] rounded-t-[var(--ds-radius-xl)] animate-in slide-in-from-bottom duration-300"
            : "w-full max-w-md max-h-[85vh] rounded-[var(--ds-radius-xl)] animate-in zoom-in-95 duration-200"
        )}
      >
        {/* モバイル用ドロワーハンドル */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-[var(--ds-radius-pill)] bg-[var(--outline-variant)]" />
          </div>
        )}

        {/* ヘッダー */}
        <div className={cn(
          "flex items-center px-5 py-4 border-b border-[var(--outline-variant)]/50",
          isMobile && "pt-2"
        )}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--primary-container)] text-primary">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">勤怠詳細</h2>
              <p className="text-xs text-muted-foreground">{formatDate(clockIn)}</p>
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ステータス */}
          <div className="flex items-center justify-center">
            {clockOut ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-[var(--ds-radius-pill)] bg-[var(--status-approved-bg)] text-[var(--status-approved)]">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-bold">退勤済み</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-[var(--ds-radius-pill)] bg-[var(--primary-container)] text-primary">
                <Play className="h-5 w-5" />
                <span className="font-bold">勤務中</span>
              </div>
            )}
          </div>

          {/* 時刻情報 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">出勤</div>
              <div className="text-2xl font-bold tabular-nums">{formatTime(clockIn)}</div>
            </div>
            <div className="rounded-[var(--ds-radius-md)] bg-[var(--surface-container)] p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">退勤</div>
              <div className="text-2xl font-bold tabular-nums">
                {clockOut ? formatTime(clockOut) : "--:--"}
              </div>
            </div>
          </div>

          {/* やったこと（タスク） */}
          {session.tasks && session.tasks.length > 0 && (
            <div className="rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-container)]/50 border-b border-[var(--outline-variant)]/50">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">やったこと</span>
              </div>
              <div className="px-4 py-3 space-y-2">
                {session.tasks.map((task, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-[var(--ds-radius-pill)] bg-[var(--primary)]" />
                    <span className="text-sm text-foreground">{task}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 休憩情報 */}
          {breaks.length > 0 && (
            <div className="rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-container)]/50 border-b border-[var(--outline-variant)]/50">
                <Coffee className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">休憩記録</span>
              </div>
              <div className="divide-y divide-[var(--outline-variant)]/50">
                {breaks.map((b, idx) => (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm">
                      {formatTime(b.start)} - {b.end ? formatTime(b.end) : "休憩中"}
                    </span>
                    {b.end && (
                      <span className="text-sm font-medium tabular-nums text-muted-foreground">
                        {Math.round((b.end.getTime() - b.start.getTime()) / 60000)}分
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* サマリー */}
          <div className="rounded-[var(--ds-radius-md)] border border-[var(--outline-variant)] bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">勤務時間</span>
              <span className="text-lg font-bold tabular-nums">
                {Math.floor(workMin / 60)}時間{workMin % 60}分
              </span>
            </div>
            {breakMin > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">休憩時間</span>
                <span className="text-sm font-medium tabular-nums text-muted-foreground">
                  {breakMin}分
                </span>
              </div>
            )}
            {hourlyRate > 0 && clockOut && (
              <>
                <div className="border-t border-[var(--outline-variant)]/50 pt-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">時給</span>
                  <span className="text-sm font-medium tabular-nums">
                    ¥{hourlyRate.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">推定給与</span>
                  <span className="text-xl font-bold tabular-nums text-primary">
                    ¥{estimatedPay.toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
