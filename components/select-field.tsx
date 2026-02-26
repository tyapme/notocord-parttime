"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectFieldOption = {
  value: string;
  label: string;
  disabled?: boolean;
  disabledLabel?: string;
};

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  emptyLabel = "選択肢がありません",
  className,
  triggerClassName,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectFieldOption[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  triggerClassName?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="text-sm font-medium text-[var(--on-surface-variant)]">{label}</label>}
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            "input-base h-auto",
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">{emptyLabel}</div>
          ) : (
            options.map((o) => (
              <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                <span className="flex w-full items-center justify-between gap-2">
                  <span>{o.label}</span>
                  {o.disabled && o.disabledLabel && (
                    <span className="text-[10px] text-muted-foreground">{o.disabledLabel}</span>
                  )}
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
