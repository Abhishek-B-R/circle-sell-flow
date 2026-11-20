/**
 * Core vocabulary of the dynamic listing system.
 *
 * A *field definition* is a reusable question ("RAM", "Battery health").
 * A *category field* is that question placed inside one category, with
 * per-category settings (order, required, visibility rule, shown on card).
 * A *resolved field* is the two merged together: exactly what a form renders.
 *
 * Everything in this folder is framework-free so the same code runs in the
 * browser (instant feedback) and on the server (the source of truth).
 */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "select",
  "radio",
  "multiselect",
  "checkbox",
  "date",
  "dimensions",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldOption {
  /** Stable machine value stored on listings. Never shown to users. */
  value: string;
  /** Human label. Safe to edit at any time. */
  label: string;
}

/** Type-specific rules. Which keys apply depends on the field type. */
export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Number fields only: reject decimals. */
  integer?: boolean;
  /** Multiselect only. */
  minItems?: number;
  maxItems?: number;
  /** Date only, YYYY-MM-DD or the literal "today". */
  minDate?: string;
  maxDate?: string;
}

export const CONDITION_OPERATORS = ["equals", "notEquals", "in", "isFilled", "isEmpty"] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

/**
 * Show this field only when another field in the same category matches.
 * Example: show "Warranty expiry" when `under_warranty` equals "yes".
 */
export interface VisibilityCondition {
  fieldKey: string;
  operator: ConditionOperator;
  /** string for equals/notEquals, string[] for in, unused for isFilled/isEmpty. */
  value?: string | string[];
}

export interface DimensionsValue {
  length: number;
  width: number;
  height: number;
}

/** Union of every value shape a field can hold. */
export type FieldValue = string | number | boolean | string[] | DimensionsValue;

export type AttributeValues = Record<string, FieldValue>;

export interface FieldDefinition {
  id: number;
  key: string;
  label: string;
  type: FieldType;
  helpText: string | null;
  placeholder: string | null;
  /** Suffix shown next to inputs and values, e.g. "GB", "%", "cm". */
  unit: string | null;
  options: FieldOption[];
  validation: FieldValidation;
  defaultValue: FieldValue | null;
}

export interface CategoryFieldConfig {
  fieldId: number;
  required: boolean;
  /** Surface this value on product cards (e.g. "128 GB · 8 GB RAM"). */
  showOnCard: boolean;
  condition: VisibilityCondition | null;
}

export interface ResolvedField extends FieldDefinition {
  required: boolean;
  showOnCard: boolean;
  condition: VisibilityCondition | null;
}

/**
 * The frozen copy of a field stored on each listing at publish time, so a
 * listing keeps rendering correctly after admins rename, re-option or
 * remove fields.
 */
export interface FieldSnapshot {
  key: string;
  label: string;
  type: FieldType;
  unit: string | null;
  options: FieldOption[];
  showOnCard: boolean;
}
