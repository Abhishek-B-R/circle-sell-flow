"use client";

import { useMemo } from "react";
import { GitBranch } from "lucide-react";
import { describeCondition, visibleFieldKeys } from "@/lib/fields/conditions";
import type { AttributeValues, FieldValue, ResolvedField } from "@/lib/fields/types";
import { FieldShell } from "../ui";
import { FIELD_INPUTS } from "./inputs";

interface Props {
  fields: ResolvedField[];
  values: AttributeValues;
  errors?: Record<string, string>;
  onChange: (key: string, value: FieldValue | undefined) => void;
  onBlur?: (key: string) => void;
  /** Admin preview: label fields that appear because of a rule. */
  showRuleHints?: boolean;
  idPrefix?: string;
}

/**
 * Renders any category's fields from its definition. There is no per-category
 * form anywhere in the app: phones, laptops and sofas all go through here.
 */
export function DynamicFields({ fields, values, errors = {}, onChange, onBlur, showRuleHints, idPrefix = "attr" }: Props) {
  const visible = useMemo(() => visibleFieldKeys(fields, values), [fields, values]);
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);

  return (
    <div className="space-y-5">
      {fields
        .filter((f) => visible.has(f.key))
        .map((field) => {
          const Input = FIELD_INPUTS[field.type];
          const id = `${idPrefix}-${field.key}`;
          const error = errors[field.key];
          return (
            <div key={field.key} className={field.condition ? "animate-reveal" : undefined}>
              <FieldShell
                id={id}
                label={field.label}
                required={field.required && field.type !== "checkbox"}
                help={field.helpText}
                error={error}
                aside={
                  showRuleHints && field.condition ? (
                    <span className="inline-flex items-center gap-1 text-xs text-brand">
                      <GitBranch className="size-3" />
                      when {describeCondition(field.condition, byKey.get(field.condition.fieldKey))}
                    </span>
                  ) : undefined
                }
              >
                <Input id={id} field={field} value={values[field.key]} onChange={(v) => onChange(field.key, v)} onBlur={() => onBlur?.(field.key)} invalid={!!error} />
              </FieldShell>
            </div>
          );
        })}
    </div>
  );
}
