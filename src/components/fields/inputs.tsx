"use client";

import { useEffect, useState, type ComponentType } from "react";
import { Check } from "lucide-react";
import { resolveDateBound } from "@/lib/fields/registry";
import type { DimensionsValue, FieldType, FieldValue, ResolvedField } from "@/lib/fields/types";
import { cn, Input, Select, Textarea } from "../ui";

export interface FieldInputProps {
  id: string;
  field: ResolvedField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue | undefined) => void;
  onBlur?: () => void;
  invalid?: boolean;
}

const describedBy = (id: string, invalid?: boolean) => (invalid ? `${id}-error` : `${id}-help`);

const toNumber = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));

function Suffix({ unit, children }: { unit: string | null; children: React.ReactNode }) {
  if (!unit) return <>{children}</>;
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-3">{unit}</span>
    </div>
  );
}

function TextInput({ id, field, value, onChange, onBlur, invalid }: FieldInputProps) {
  return (
    <Suffix unit={field.unit}>
      <Input
        id={id}
        value={(value as string) ?? ""}
        placeholder={field.placeholder ?? undefined}
        maxLength={field.validation.maxLength}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        invalid={invalid}
        aria-describedby={describedBy(id, invalid)}
        className={field.unit ? "pr-14" : undefined}
      />
    </Suffix>
  );
}

function TextareaInput({ id, field, value, onChange, onBlur, invalid }: FieldInputProps) {
  const text = (value as string) ?? "";
  const max = field.validation.maxLength;
  return (
    <div>
      <Textarea
        id={id}
        value={text}
        placeholder={field.placeholder ?? undefined}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        invalid={invalid}
        aria-describedby={describedBy(id, invalid)}
      />
      {max && <p className="mt-1 text-right text-xs text-ink-3 tabular-nums">{text.length} / {max}</p>}
    </div>
  );
}

function NumberInput({ id, field, value, onChange, onBlur, invalid }: FieldInputProps) {
  const v = field.validation;
  return (
    <Suffix unit={field.unit}>
      <Input
        id={id}
        type="number"
        inputMode={v.integer ? "numeric" : "decimal"}
        step={v.integer ? 1 : "any"}
        min={v.min}
        max={v.max}
        value={value === undefined ? "" : String(value)}
        placeholder={field.placeholder ?? undefined}
        onChange={(e) => onChange(toNumber(e.target.value))}
        onWheel={(e) => e.currentTarget.blur()}
        onBlur={onBlur}
        invalid={invalid}
        aria-describedby={describedBy(id, invalid)}
        className={cn("tabular-nums", field.unit && "pr-16")}
      />
    </Suffix>
  );
}

function SelectInput({ id, field, value, onChange, onBlur, invalid }: FieldInputProps) {
  return (
    <Select
      id={id}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      onBlur={onBlur}
      invalid={invalid}
      aria-describedby={describedBy(id, invalid)}
      className="h-11"
    >
      <option value="">{field.placeholder ?? `Select ${field.label.toLowerCase()}`}</option>
      {field.options.map((o) => (
        <option key={o.value} value={o.value} className="text-ink">
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/** Pill-style options: faster to scan and tap than a dropdown when there are only a few. */
function Choice({ selected, onClick, children, multi }: { selected: boolean; onClick: () => void; children: React.ReactNode; multi?: boolean }) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
        selected ? "border-brand bg-brand-soft font-medium text-brand-ink" : "border-line-2 bg-surface text-ink-2 hover:border-ink-3",
      )}
    >
      {multi && selected && <Check className="size-3.5" strokeWidth={3} />}
      {children}
    </button>
  );
}

function RadioInput({ id, field, value, onChange, invalid }: FieldInputProps) {
  return (
    <div id={id} role="radiogroup" aria-invalid={invalid || undefined} aria-describedby={describedBy(id, invalid)} className="flex flex-wrap gap-2">
      {field.options.map((o) => (
        <Choice key={o.value} selected={value === o.value} onClick={() => onChange(value === o.value && !field.required ? undefined : o.value)}>
          {o.label}
        </Choice>
      ))}
    </div>
  );
}

function MultiselectInput({ id, field, value, onChange, invalid }: FieldInputProps) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    // Keep option order stable regardless of click order.
    onChange(field.options.map((o) => o.value).filter((x) => next.includes(x)));
  };
  return (
    <div id={id} role="group" aria-invalid={invalid || undefined} aria-describedby={describedBy(id, invalid)} className="flex flex-wrap gap-2">
      {field.options.map((o) => (
        <Choice key={o.value} multi selected={selected.includes(o.value)} onClick={() => toggle(o.value)}>
          {o.label}
        </Choice>
      ))}
    </div>
  );
}

function CheckboxInput({ id, field, value, onChange }: FieldInputProps) {
  const checked = value === true;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-line-2 bg-surface px-3 py-2.5 hover:border-ink-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
      <span className="text-[15px] text-ink-2">{checked ? "Yes" : "No"}</span>
    </label>
  );
}

function DateInput({ id, field, value, onChange, onBlur, invalid }: FieldInputProps) {
  const v = field.validation;
  // "today" depends on the viewer's clock, so resolve bounds only after mount (avoids hydration mismatches).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const bound = (b: string | undefined, kind: "min" | "max") => (b && (mounted || b !== "today") ? resolveDateBound(b, kind, false) : undefined);
  return (
    <Input
      id={id}
      type="date"
      value={(value as string) ?? ""}
      min={bound(v.minDate, "min")}
      max={bound(v.maxDate, "max")}
      onChange={(e) => onChange(e.target.value || undefined)}
      onBlur={onBlur}
      invalid={invalid}
      aria-describedby={describedBy(id, invalid)}
      className="max-w-56"
    />
  );
}

function DimensionsInput({ id, field, value, onChange, onBlur, invalid }: FieldInputProps) {
  const d = (value ?? {}) as Partial<DimensionsValue>;
  const set = (side: keyof DimensionsValue, raw: string) => {
    const next = { ...d, [side]: toNumber(raw) };
    const empty = next.length === undefined && next.width === undefined && next.height === undefined;
    onChange(empty ? undefined : (next as DimensionsValue));
  };
  const sides: [keyof DimensionsValue, string][] = [
    ["length", "Length"],
    ["width", "Width"],
    ["height", "Height"],
  ];
  return (
    <div id={id} className="grid grid-cols-3 gap-2" aria-describedby={describedBy(id, invalid)}>
      {sides.map(([side, label]) => (
        <label key={side} className="block">
          <span className="mb-1 block text-xs text-ink-3">{label}</span>
          <Suffix unit={field.unit}>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={d[side] === undefined ? "" : String(d[side])}
              onChange={(e) => set(side, e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              onBlur={onBlur}
              invalid={invalid}
              aria-label={`${field.label} ${label.toLowerCase()}`}
              className="pr-10 tabular-nums"
            />
          </Suffix>
        </label>
      ))}
    </div>
  );
}

/** Field type -> input component. The UI counterpart of FIELD_TYPE_REGISTRY. */
export const FIELD_INPUTS: Record<FieldType, ComponentType<FieldInputProps>> = {
  text: TextInput,
  textarea: TextareaInput,
  number: NumberInput,
  select: SelectInput,
  radio: RadioInput,
  multiselect: MultiselectInput,
  checkbox: CheckboxInput,
  date: DateInput,
  dimensions: DimensionsInput,
};
