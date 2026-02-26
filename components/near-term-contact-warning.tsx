"use client";

export function NearTermContactWarning({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--ds-radius-md)] border border-[var(--status-pending)]/30 bg-[var(--status-pending-bg)]/35 px-3.5 py-3">
      <p className="text-xs font-semibold text-[var(--status-pending)]">直近のシフトです</p>
      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{message}</p>
    </div>
  );
}
