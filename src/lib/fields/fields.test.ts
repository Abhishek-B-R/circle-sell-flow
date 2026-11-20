import { describe, expect, it } from "vitest";
import { visibleFieldKeys } from "./conditions";
import { fieldDefinitionInputSchema, slugifyKey } from "./definition-schema";
import { formatFieldValue } from "./registry";
import type { ResolvedField } from "./types";
import { validateAttributes, validateCategoryLayout } from "./validate";

let nextId = 1;
const field = (f: Partial<ResolvedField> & Pick<ResolvedField, "key" | "type">): ResolvedField => ({
  id: nextId++,
  label: f.key,
  helpText: null,
  placeholder: null,
  unit: null,
  options: [],
  validation: {},
  defaultValue: null,
  required: false,
  showOnCard: false,
  condition: null,
  ...f,
});

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const warranty = [
  field({ key: "under_warranty", label: "Under warranty", type: "radio", options: yesNo, required: true }),
  field({
    key: "warranty_expiry",
    label: "Warranty expiry",
    type: "date",
    required: true,
    condition: { fieldKey: "under_warranty", operator: "equals", value: "yes" },
  }),
];

describe("conditional fields", () => {
  it("shows the dependent field only when the rule matches", () => {
    expect(visibleFieldKeys(warranty, { under_warranty: "no" }).has("warranty_expiry")).toBe(false);
    expect(visibleFieldKeys(warranty, { under_warranty: "yes" }).has("warranty_expiry")).toBe(true);
  });

  it("requires a visible conditional field", () => {
    const r = validateAttributes(warranty, { under_warranty: "yes" });
    expect(r.errors.warranty_expiry).toBe("Warranty expiry is required");
  });

  it("drops answers to hidden fields instead of storing stale data", () => {
    const r = validateAttributes(warranty, { under_warranty: "no", warranty_expiry: "2030-01-01" });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ under_warranty: "no" });
  });

  it("hides a whole chain when the first link is hidden", () => {
    const chain = [
      field({ key: "a", type: "radio", options: yesNo }),
      field({ key: "b", type: "radio", options: yesNo, condition: { fieldKey: "a", operator: "equals", value: "yes" } }),
      field({ key: "c", type: "text", condition: { fieldKey: "b", operator: "equals", value: "yes" } }),
    ];
    // b's stale "yes" must not keep c visible once a is "no".
    expect([...visibleFieldKeys(chain, { a: "no", b: "yes" })]).toEqual(["a"]);
  });

  it("supports in / isFilled operators and checkbox controllers", () => {
    const fs = [
      field({ key: "storage", type: "select", options: [{ value: "64gb", label: "64" }, { value: "1tb", label: "1T" }] }),
      field({ key: "big", type: "text", condition: { fieldKey: "storage", operator: "in", value: ["1tb"] } }),
      field({ key: "box", type: "checkbox" }),
      field({ key: "box_note", type: "text", condition: { fieldKey: "box", operator: "equals", value: "true" } }),
      field({ key: "notes", type: "text", condition: { fieldKey: "storage", operator: "isFilled" } }),
    ];
    const v = visibleFieldKeys(fs, { storage: "1tb", box: true });
    expect([...v].sort()).toEqual(["big", "box", "box_note", "notes", "storage"]);
    expect(visibleFieldKeys(fs, { box: false }).has("notes")).toBe(false);
  });
});

describe("validation per type", () => {
  const fs = [
    field({ key: "battery", label: "Battery health", type: "number", validation: { min: 1, max: 100, integer: true } }),
    field({ key: "model", label: "Model", type: "text", validation: { minLength: 2, maxLength: 5 } }),
    field({ key: "ram", label: "RAM", type: "select", options: [{ value: "8gb", label: "8 GB" }] }),
    field({ key: "acc", label: "Accessories", type: "multiselect", options: yesNo, validation: { maxItems: 1 } }),
    field({ key: "dims", label: "Dimensions", type: "dimensions", validation: { max: 300 } }),
    field({ key: "bought", label: "Purchase date", type: "date", validation: { maxDate: "today" } }),
  ];

  it("reports one clear message per field", () => {
    const r = validateAttributes(fs, {
      battery: 101.5,
      model: "x",
      ram: "16gb",
      acc: ["yes", "no"],
      dims: { length: 100, width: 50, height: 400 },
      bought: "2999-01-01",
    });
    expect(r.errors).toEqual({
      battery: "Battery health must be a whole number",
      model: "Model must be at least 2 characters",
      ram: "Choose a valid option for RAM",
      acc: "Pick at most 1 for Accessories",
      dims: "Dimensions must be at most 300",
      bought: "Purchase date can't be after today",
    });
  });

  it("accepts valid values, trims text and ignores unknown keys", () => {
    const r = validateAttributes(fs, { battery: 90, model: "  13  ", ram: "8gb", hacker: "x" });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ battery: 90, model: "13", ram: "8gb" });
  });

  it("rejects wrong value shapes", () => {
    const r = validateAttributes(fs, { battery: "90", dims: { length: 1 } });
    expect(Object.keys(r.errors).sort()).toEqual(["battery", "dims"]);
  });
});

describe("category layout rules", () => {
  it("rejects a condition on a field placed below", () => {
    const [a, b] = warranty;
    expect(validateCategoryLayout([b, a])[0]).toMatch(/placed below/);
    expect(validateCategoryLayout([a, b])).toEqual([]);
  });

  it("rejects a condition on a missing option", () => {
    const [a, b] = warranty;
    const broken = { ...b, condition: { fieldKey: "under_warranty", operator: "equals" as const, value: "maybe" } };
    expect(validateCategoryLayout([a, broken])[0]).toMatch(/no longer exists/);
  });
});

describe("field definitions", () => {
  it("slugifies labels into keys", () => {
    expect(slugifyKey("Battery health (%)")).toBe("battery_health");
    expect(slugifyKey("4K support?")).toBe("f_4k_support");
  });

  it("drops settings that don't apply to the type", () => {
    const parsed = fieldDefinitionInputSchema.parse({
      key: "ram",
      label: "RAM",
      type: "select",
      options: [{ value: "8gb", label: "8 GB" }, { value: "16gb", label: "16 GB" }],
      validation: { min: 1, maxLength: 3 },
      unit: "GB",
    });
    expect(parsed.validation).toEqual({});
    expect(parsed.unit).toBeNull();
  });

  it("requires options for choice types and checks the default value", () => {
    const r = fieldDefinitionInputSchema.safeParse({ key: "ram", label: "RAM", type: "radio", options: [{ value: "a", label: "A" }], defaultValue: "b" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["options", "defaultValue"]));
  });
});

describe("formatting", () => {
  it("renders values for humans", () => {
    expect(formatFieldValue({ length: 210, width: 90, height: 85 }, { type: "dimensions", unit: "cm", options: [] })).toBe("210 × 90 × 85 cm");
    expect(formatFieldValue(["yes"], { type: "multiselect", unit: null, options: yesNo })).toBe("Yes");
    expect(formatFieldValue(86, { type: "number", unit: "%", options: [] })).toBe("86 %");
    expect(formatFieldValue("2024-03-12", { type: "date", unit: null, options: [] })).toBe("12 Mar 2024");
  });
});
