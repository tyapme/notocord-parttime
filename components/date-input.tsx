"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { ja } from "date-fns/locale";
import type { Matcher } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatYmd, parseYmdToDate } from "@/lib/datetime";

type DateInputProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  className?: string;
  inputClassName?: string;
};

export function DateInput({
  label,
  value,
  onChange,
  min,
  max,
  placeholder = "YYYY-MM-DD",
  required,
  helperText,
  className,
  inputClassName,
}: DateInputProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => parseYmdToDate(value) ?? undefined, [value]);
  const minDate = useMemo(() => (min ? parseYmdToDate(min) ?? undefined : undefined), [min]);
  const maxDate = useMemo(() => (max ? parseYmdToDate(max) ?? undefined : undefined), [max]);
  const disabled = useMemo<Matcher[] | undefined>(() => {
    const matchers: Matcher[] = [];
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [minDate, maxDate]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium text-[var(--on-surface-variant)]">{label}</label>
      <div className="relative" ref={wrapperRef}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          required={required}
          placeholder={placeholder}
          inputMode="numeric"
          className={cn("input-base pr-10", !value && "text-muted-foreground", inputClassName)}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[var(--ds-radius-sm)] p-1.5 text-muted-foreground hover:bg-[var(--secondary-container)] hover:text-[var(--on-secondary-container)] transition-colors"
          aria-label="カレンダーを開く"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
        {open && (
          <div className="absolute left-0 bottom-full z-50 mb-2 rounded-[var(--ds-radius-xl)] border border-[var(--outline-variant)] bg-[var(--surface-container-high)] p-1 shadow-[var(--ds-elevation-overlay)] motion-fade-in">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(date) => {
                if (!date) return;
                onChange(formatYmd(date));
                setOpen(false);
              }}
              locale={ja}
              weekStartsOn={1}
              formatters={{
                formatCaption: (date) =>
                  new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(date),
              }}
              disabled={disabled}
              initialFocus
            />
          </div>
        )}
      </div>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}
