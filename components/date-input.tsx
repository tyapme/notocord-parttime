"use client";

import { cn } from "@/lib/utils";

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
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium text-[var(--on-surface-variant)]">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        required={required}
        placeholder={placeholder}
        className={cn("input-base w-full min-w-0", !value && "text-muted-foreground", inputClassName)}
      />
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}
