"use client";

import { FixRequest, FlexRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SelectField } from "@/components/select-field";
import {
  FixDetailRows,
  FlexDetailRows,
  MetaTag,
  TypeTag,
} from "@/components/shift-request-ui";

export { MetaTag, TypeTag };

export function RadioOption({
  selected,
  label,
  desc,
  onClick,
}: {
  selected: boolean;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-[var(--ds-radius-md)] border px-4 py-3 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
      )}
    >
      <div
        className={cn(
          "h-4 w-4 rounded-[var(--ds-radius-pill)] border-2 shrink-0 flex items-center justify-center transition-colors",
          selected ? "border-primary" : "border-border"
        )}
      >
        {selected && <div className="h-1.5 w-1.5 rounded-[var(--ds-radius-pill)] bg-primary" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      className="max-w-[15rem]"
      triggerClassName="text-sm tabular-nums"
    />
  );
}

export function FixDetail({ req }: { req: FixRequest }) {
  return <FixDetailRows req={req} />;
}

export function FlexDetail({ req }: { req: FlexRequest }) {
  return <FlexDetailRows req={req} />;
}
