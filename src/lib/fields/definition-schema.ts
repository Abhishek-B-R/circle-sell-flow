import { z } from "zod";
import { CONDITION_OPERATORS, FIELD_TYPES, type FieldValidation, type FieldValue } from "./types";
import { FIELD_TYPE_REGISTRY, isEmptyValue } from "./registry";

export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

/** "Battery health (%)" -> "battery_health" */
export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "f_$1")
    .slice(0, 40);
}

const optionSchema = z.object({
  value: z.string().trim().regex(/^[a-z0-9_-]{1,40}$/, "Option values use lowercase letters, numbers, - and _"),
  label: z.string().trim().min(1, "Option label can't be empty").max(60),
});

const validationSchema = z
  .object({
    minLength: z.number().int().min(0).max(5000),
    maxLength: z.number().int().min(1).max(5000),
    min: z.number(),
    max: z.number(),
    integer: z.boolean(),
    minItems: z.number().int().min(0).max(50),
    maxItems: z.number().int().min(1).max(50),
    minDate: z.string().regex(/^(today|\d{4}-\d{2}-\d{2})$/, "Use a date or \"today\""),
    maxDate: z.string().regex(/^(today|\d{4}-\d{2}-\d{2})$/, "Use a date or \"today\""),
  })
  .partial();

/** Admin input for creating or editing a reusable field. */
export const fieldDefinitionInputSchema = z
  .object({
    key: z.string().trim().regex(FIELD_KEY_PATTERN, "Key must be lowercase snake_case, 2–40 characters, starting with a letter"),
    label: z.string().trim().min(2, "Label must be at least 2 characters").max(60),
    type: z.enum(FIELD_TYPES),
    helpText: z.string().trim().max(200).nullish().transform((v) => v || null),
    placeholder: z.string().trim().max(80).nullish().transform((v) => v || null),
    unit: z.string().trim().max(12).nullish().transform((v) => v || null),
    options: z.array(optionSchema).max(100).default([]),
    validation: validationSchema.default({}),
    defaultValue: z.unknown().nullish().transform((v) => (isEmptyValue(v) ? null : (v as FieldValue))),
  })
  .transform((input) => {
    // Drop settings that don't apply to the chosen type, so switching a field
    // from Number to Dropdown can't leave a stray "max: 100" behind.
    const supports = FIELD_TYPE_REGISTRY[input.type].supports;
    const v = input.validation;
    return {
      ...input,
      options: supports.options ? input.options : [],
      placeholder: supports.placeholder ? input.placeholder : null,
      unit: supports.unit ? input.unit : null,
      validation: {
        ...(supports.length ? { minLength: v.minLength, maxLength: v.maxLength } : {}),
        ...(supports.range ? { min: v.min, max: v.max, integer: v.integer } : {}),
        ...(supports.items ? { minItems: v.minItems, maxItems: v.maxItems } : {}),
        ...(supports.dates ? { minDate: v.minDate, maxDate: v.maxDate } : {}),
      },
    };
  })
  .transform((input) => ({
    ...input,
    defaultValue: input.defaultValue as FieldValue | null,
    // Strip keys left undefined above so the stored JSON stays tidy.
    validation: Object.fromEntries(Object.entries(input.validation).filter(([, v]) => v !== undefined)) as FieldValidation,
  }))
  .superRefine((input, ctx) => {
    const v = input.validation;
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: path.split("."), message });

    if (FIELD_TYPE_REGISTRY[input.type].supports.options) {
      if (input.options.length < 2) issue("options", "Add at least two options");
      const values = input.options.map((o) => o.value);
      if (new Set(values).size !== values.length) issue("options", "Option values must be unique");
    }
    if (v.minLength != null && v.maxLength != null && v.minLength > v.maxLength) issue("validation.maxLength", "Max length must be ≥ min length");
    if (v.min != null && v.max != null && v.min > v.max) issue("validation.max", "Max must be ≥ min");
    if (v.minItems != null && v.maxItems != null && v.minItems > v.maxItems) issue("validation.maxItems", "Max picks must be ≥ min picks");
    if (v.maxItems != null && input.options.length > 0 && v.minItems != null && v.minItems > input.options.length)
      issue("validation.minItems", "Min picks can't exceed the number of options");

    if (input.defaultValue != null) {
      const spec = FIELD_TYPE_REGISTRY[input.type];
      const parsed = spec.schema({ label: "Default value", options: input.options, validation: input.validation }).safeParse(input.defaultValue);
      if (!parsed.success) issue("defaultValue", parsed.error.issues[0]?.message ?? "Default value doesn't fit this field");
    }
  });

export type FieldDefinitionInput = z.output<typeof fieldDefinitionInputSchema>;

export const conditionSchema = z.object({
  fieldKey: z.string().regex(FIELD_KEY_PATTERN),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.union([z.string(), z.array(z.string())]).optional(),
});

/** Full arrangement of a category's fields, saved atomically. */
export const categoryLayoutInputSchema = z.object({
  fields: z
    .array(
      z.object({
        fieldId: z.number().int().positive(),
        required: z.boolean().default(false),
        showOnCard: z.boolean().default(false),
        condition: conditionSchema.nullish().transform((c) => c ?? null),
      }),
    )
    .max(60, "A category can have at most 60 fields"),
});

export const CATEGORY_ICONS = [
  "smartphone",
  "laptop",
  "sofa",
  "tablet",
  "watch",
  "headphones",
  "camera",
  "gamepad",
  "tv",
  "bike",
  "car",
  "shirt",
  "book",
  "refrigerator",
  "armchair",
  "package",
] as const;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(40),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug uses lowercase letters, numbers and dashes")
    .max(40),
  description: z.string().trim().max(160).nullish().transform((v) => v || null),
  icon: z.enum(CATEGORY_ICONS).default("package"),
  isActive: z.boolean().default(true),
});

export type CategoryInput = z.output<typeof categoryInputSchema>;
