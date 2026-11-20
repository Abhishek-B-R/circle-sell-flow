import { isEmptyValue } from "./registry";
import type { AttributeValues, ConditionOperator, ResolvedField, VisibilityCondition } from "./types";

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "is",
  notEquals: "is not",
  in: "is any of",
  isFilled: "is filled in",
  isEmpty: "is empty",
};

export const operatorNeedsValue = (op: ConditionOperator) => op === "equals" || op === "notEquals" || op === "in";

/** Compares a stored value with a condition value; booleans compare as "true"/"false". */
function asComparable(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null) return [];
  return [String(value)];
}

export function matchesCondition(condition: VisibilityCondition, value: unknown): boolean {
  const actual = asComparable(value);
  const expected = Array.isArray(condition.value) ? condition.value : condition.value != null ? [condition.value] : [];
  switch (condition.operator) {
    case "isFilled":
      return !isEmptyValue(value);
    case "isEmpty":
      return isEmptyValue(value);
    case "equals":
      return actual.some((a) => a === expected[0]);
    case "notEquals":
      return !actual.some((a) => a === expected[0]);
    case "in":
      return actual.some((a) => expected.includes(a));
  }
}

/**
 * Returns the keys of fields that should currently be shown.
 *
 * A field is visible when it has no condition, or when its controlling field
 * is itself visible and matches. Chains (A controls B controls C) collapse
 * correctly: hiding A hides C too. Config validation guarantees a controlling
 * field always comes earlier, so one ordered pass is enough.
 */
export function visibleFieldKeys(fields: ResolvedField[], values: AttributeValues): Set<string> {
  const visible = new Set<string>();
  for (const field of fields) {
    const c = field.condition;
    if (!c || (visible.has(c.fieldKey) && matchesCondition(c, values[c.fieldKey]))) {
      visible.add(field.key);
    }
  }
  return visible;
}

export function describeCondition(condition: VisibilityCondition, controller?: Pick<ResolvedField, "label" | "options" | "type">) {
  const name = controller?.label ?? condition.fieldKey;
  const label = (v: string) => {
    if (controller?.type === "checkbox") return v === "true" ? "Yes" : "No";
    return controller?.options.find((o) => o.value === v)?.label ?? v;
  };
  const values = Array.isArray(condition.value) ? condition.value : condition.value != null ? [condition.value] : [];
  const rhs = operatorNeedsValue(condition.operator) ? ` ${values.map(label).join(" / ") || "…"}` : "";
  return `${name} ${OPERATOR_LABELS[condition.operator]}${rhs}`;
}
