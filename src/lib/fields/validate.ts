import { visibleFieldKeys } from "./conditions";
import { FIELD_TYPE_REGISTRY, isEmptyValue } from "./registry";
import type { AttributeValues, FieldSnapshot, FieldValue, ResolvedField } from "./types";

export type FieldErrors = Record<string, string>;

export interface AttributeValidationResult {
  ok: boolean;
  /** Cleaned values: only visible, filled-in fields, in schema order. */
  values: AttributeValues;
  errors: FieldErrors;
}

/**
 * Validates category-specific answers against the category's field config.
 * Runs unchanged in the browser and in the API.
 *
 * - Hidden fields are dropped, so a stale "warranty expiry" never survives
 *   switching "under warranty" back to No.
 * - Keys that aren't part of the category are ignored.
 */
export function validateAttributes(fields: ResolvedField[], input: Record<string, unknown>): AttributeValidationResult {
  const visible = visibleFieldKeys(fields, input as AttributeValues);
  const values: AttributeValues = {};
  const errors: FieldErrors = {};

  for (const field of fields) {
    if (!visible.has(field.key)) continue;
    const raw = input[field.key];
    if (isEmptyValue(raw)) {
      if (field.required) errors[field.key] = `${field.label} is required`;
      continue;
    }
    const parsed = FIELD_TYPE_REGISTRY[field.type].schema(field).safeParse(raw);
    if (parsed.success) values[field.key] = parsed.data;
    else errors[field.key] = parsed.error.issues[0]?.message ?? `${field.label} is invalid`;
  }

  return { ok: Object.keys(errors).length === 0, values, errors };
}

/** Starting values for a fresh form: each field's default, if it has one. */
export function initialValues(fields: ResolvedField[]): AttributeValues {
  const values: AttributeValues = {};
  for (const f of fields) {
    if (f.defaultValue != null) values[f.key] = f.defaultValue as FieldValue;
    else if (f.type === "checkbox") values[f.key] = false;
  }
  return values;
}

export function snapshotFields(fields: ResolvedField[]): FieldSnapshot[] {
  return fields.map(({ key, label, type, unit, options, showOnCard }) => ({ key, label, type, unit, options, showOnCard }));
}

/**
 * Checks a category's field arrangement before it is saved.
 * Rules that keep the seller form predictable:
 * - a field appears once
 * - a condition points at a field placed *earlier* in the same category
 *   (reads naturally top to bottom, and makes cycles impossible)
 * - the condition's operator and values make sense for that field
 */
export function validateCategoryLayout(fields: ResolvedField[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, ResolvedField>();

  for (const field of fields) {
    if (seen.has(field.key)) problems.push(`"${field.label}" is added twice`);
    const c = field.condition;
    if (c) {
      const controller = seen.get(c.fieldKey);
      if (!controller) {
        const exists = fields.some((f) => f.key === c.fieldKey);
        problems.push(
          exists
            ? `"${field.label}" depends on a field placed below it. Move it under the field it depends on.`
            : `"${field.label}" depends on a field that isn't in this category`,
        );
      } else {
        const needsValue = c.operator === "equals" || c.operator === "notEquals" || c.operator === "in";
        const values = Array.isArray(c.value) ? c.value : c.value != null ? [c.value] : [];
        if (needsValue && values.length === 0) problems.push(`"${field.label}": pick the value(s) that should show it`);
        if (controller.options.length > 0 && values.some((v) => !controller.options.some((o) => o.value === v))) {
          problems.push(`"${field.label}" depends on an option that no longer exists on "${controller.label}"`);
        }
      }
    }
    seen.set(field.key, field);
  }
  return problems;
}
