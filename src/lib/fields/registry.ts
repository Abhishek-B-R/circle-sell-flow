import { z } from "zod";
import type {
  DimensionsValue,
  FieldDefinition,
  FieldOption,
  FieldType,
  FieldValidation,
  FieldValue,
} from "./types";

/**
 * One entry per field type. This is the only place that knows how a type
 * behaves: what settings it accepts, how its values are validated, and how
 * they are displayed. Adding a new type means adding one entry here and one
 * input component in `components/fields/inputs.tsx`; TypeScript flags both
 * if either is missing.
 */
export interface FieldTypeSpec {
  label: string;
  description: string;
  /** Which settings the admin field editor should offer. */
  supports: {
    options?: boolean;
    placeholder?: boolean;
    unit?: boolean;
    length?: boolean;
    range?: boolean;
    items?: boolean;
    dates?: boolean;
  };
  /** Validates a non-empty value. Emptiness and `required` are handled by the caller. */
  schema(field: SchemaInput): z.ZodType<FieldValue>;
  /** Plain-text rendering for cards, PDP and previews. */
  format(value: FieldValue, field: FormatInput): string;
}

type SchemaInput = Pick<FieldDefinition, "label" | "options" | "validation">;
export type FormatInput = { unit: string | null; options: FieldOption[] };

const withUnit = (text: string, unit: string | null) => (unit ? `${text} ${unit}` : text);

const optionLabel = (options: FieldOption[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

const formatNumber = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function textSchema({ label, validation: v }: SchemaInput) {
  let s = z.string().trim();
  if (v.minLength != null) s = s.min(v.minLength, `${label} must be at least ${v.minLength} characters`);
  if (v.maxLength != null) s = s.max(v.maxLength, `${label} must be at most ${v.maxLength} characters`);
  return s;
}

function oneOf({ label, options }: SchemaInput) {
  const values = options.map((o) => o.value);
  return z.string().refine((x) => values.includes(x), `Choose a valid option for ${label}`);
}

/**
 * Resolves "today" so rules like "purchase date can't be in the future" work.
 * The server can't know the seller's timezone, so it validates leniently (one
 * extra day) and a seller east of UTC picking their "today" is never rejected.
 */
export function resolveDateBound(bound: string, kind: "min" | "max", lenient = typeof window === "undefined"): string {
  if (bound !== "today") return bound;
  const d = new Date();
  if (lenient) d.setDate(d.getDate() + (kind === "max" ? 1 : -1));
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const formatDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

function rangeChecks<T extends z.ZodNumber>(s: T, label: string, v: FieldValidation): z.ZodNumber {
  let out: z.ZodNumber = s;
  if (v.integer) out = out.int(`${label} must be a whole number`);
  if (v.min != null) out = out.min(v.min, `${label} must be at least ${formatNumber(v.min)}`);
  if (v.max != null) out = out.max(v.max, `${label} must be at most ${formatNumber(v.max)}`);
  return out;
}

export const FIELD_TYPE_REGISTRY: Record<FieldType, FieldTypeSpec> = {
  text: {
    label: "Short text",
    description: "One line, e.g. Colour or Model",
    supports: { placeholder: true, unit: true, length: true },
    schema: textSchema,
    format: (v, f) => withUnit(String(v), f.unit),
  },
  textarea: {
    label: "Long text",
    description: "Multiple lines, e.g. Known issues",
    supports: { placeholder: true, length: true },
    schema: textSchema,
    format: (v) => String(v),
  },
  number: {
    label: "Number",
    description: "e.g. Battery health, Purchase year",
    supports: { placeholder: true, unit: true, range: true },
    schema: ({ label, validation }) =>
      rangeChecks(z.number({ error: `${label} must be a number` }), label, validation),
    format: (v, f) => withUnit(formatNumber(Number(v)), f.unit),
  },
  select: {
    label: "Dropdown",
    description: "Pick one from a long list, e.g. Storage",
    supports: { options: true, placeholder: true },
    schema: oneOf,
    format: (v, f) => optionLabel(f.options, String(v)),
  },
  radio: {
    label: "Single choice",
    description: "Pick one from a few, e.g. Yes / No",
    supports: { options: true },
    schema: oneOf,
    format: (v, f) => optionLabel(f.options, String(v)),
  },
  multiselect: {
    label: "Multiple choice",
    description: "Pick any, e.g. Accessories included",
    supports: { options: true, items: true },
    schema: ({ label, options, validation: v }) => {
      const values = options.map((o) => o.value);
      let s = z.array(z.string().refine((x) => values.includes(x), `Choose valid options for ${label}`));
      if (v.minItems != null) s = s.min(v.minItems, `Pick at least ${v.minItems} for ${label}`);
      if (v.maxItems != null) s = s.max(v.maxItems, `Pick at most ${v.maxItems} for ${label}`);
      return s.refine((xs) => new Set(xs).size === xs.length, `Duplicate choices in ${label}`);
    },
    format: (v, f) => (Array.isArray(v) ? v.map((x) => optionLabel(f.options, x)).join(", ") : String(v)),
  },
  checkbox: {
    label: "Yes / No toggle",
    description: "A single tick box, e.g. Original box included",
    supports: {},
    schema: ({ label }) => z.boolean({ error: `${label} must be yes or no` }),
    format: (v) => (v ? "Yes" : "No"),
  },
  date: {
    label: "Date",
    description: "e.g. Purchase date, Warranty expiry",
    supports: { dates: true },
    schema: ({ label, validation: v }) =>
      z
        .string()
        .regex(ISO_DATE, `${label} must be a valid date`)
        .superRefine((x, ctx) => {
          if (Number.isNaN(Date.parse(x))) ctx.addIssue({ code: "custom", message: `${label} must be a valid date` });
          if (v.minDate && x < resolveDateBound(v.minDate, "min"))
            ctx.addIssue({ code: "custom", message: `${label} can't be before ${describeBound(v.minDate)}` });
          if (v.maxDate && x > resolveDateBound(v.maxDate, "max"))
            ctx.addIssue({ code: "custom", message: `${label} can't be after ${describeBound(v.maxDate)}` });
        }),
    format: (v) => formatDate(String(v)),
  },
  dimensions: {
    label: "Dimensions",
    description: "Length × width × height, e.g. Sofa size",
    supports: { unit: true, range: true },
    schema: ({ label, validation }) => {
      const side = rangeChecks(z.number({ error: `Enter all three sides of ${label}` }).positive(`${label} must be positive`), label, validation);
      return z.object({ length: side, width: side, height: side }).strict();
    },
    format: (v, f) => {
      const d = v as DimensionsValue;
      return withUnit([d.length, d.width, d.height].map(formatNumber).join(" × "), f.unit);
    },
  },
};

const describeBound = (b: string) => (b === "today" ? "today" : formatDate(b));

/** Is this value "not filled in"? Shared by required checks and conditions. */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(
      (x) => x === undefined || x === null || x === "" || (typeof x === "number" && Number.isNaN(x)),
    );
  }
  return false; // booleans are always "filled": false is an answer.
}

export function formatFieldValue(value: FieldValue, field: FormatInput & { type: FieldType }): string {
  return FIELD_TYPE_REGISTRY[field.type].format(value, field);
}

export function fieldTypeHasOptions(type: FieldType) {
  return Boolean(FIELD_TYPE_REGISTRY[type].supports.options);
}
