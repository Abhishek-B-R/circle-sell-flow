"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  GitBranch,
  GripVertical,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { describeCondition, OPERATOR_LABELS, operatorNeedsValue } from "@/lib/fields/conditions";
import { FIELD_TYPE_REGISTRY } from "@/lib/fields/registry";
import type { AttributeValues, CategoryFieldConfig, ConditionOperator, FieldDefinition, FieldValue, ResolvedField, VisibilityCondition } from "@/lib/fields/types";
import { initialValues, validateCategoryLayout } from "@/lib/fields/validate";
import type { Category } from "@/server/db/schema";
import type { FieldWithUsage } from "@/server/services/fields";
import { CategoryIcon } from "../CategoryIcon";
import { DynamicFields } from "../fields/DynamicFields";
import { Badge, Button, Card, cn, EmptyState, Select, Switch } from "../ui";
import { CategoryDetailsForm } from "./CategoryDetailsForm";
import { FieldEditor } from "./FieldEditor";

interface Props {
  category: Category;
  initialFields: ResolvedField[];
  initialLibrary: FieldWithUsage[];
}

const toConfig = (f: ResolvedField): CategoryFieldConfig => ({ fieldId: f.id, required: f.required, showOnCard: f.showOnCard, condition: f.condition });

/**
 * Drag-and-drop form builder for one category. Edits a local draft of the
 * whole arrangement with a live seller-form preview, then saves it in one
 * request, so sellers never see a half-configured form.
 */
export function CategoryBuilder({ category: initialCategory, initialFields, initialLibrary }: Props) {
  const router = useRouter();
  const isNew = useSearchParams().has("new");
  const [category, setCategory] = useState(initialCategory);
  const [editingDetails, setEditingDetails] = useState(false);
  const [library, setLibrary] = useState(initialLibrary);
  const [layout, setLayout] = useState<CategoryFieldConfig[]>(() => initialFields.map(toConfig));
  const [savedLayout, setSavedLayout] = useState(() => JSON.stringify(initialFields.map(toConfig)));
  const [ruleOpen, setRuleOpen] = useState<number | null>(null);
  const [picking, setPicking] = useState(isNew && initialFields.length === 0);
  const [editingField, setEditingField] = useState<FieldWithUsage | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const byId = useMemo(() => new Map(library.map((f) => [f.id, f])), [library]);
  const resolved: ResolvedField[] = useMemo(
    () => layout.flatMap((c) => (byId.has(c.fieldId) ? [{ ...byId.get(c.fieldId)!, ...c }] : [])),
    [layout, byId],
  );
  const problems = useMemo(() => validateCategoryLayout(resolved), [resolved]);
  const dirty = JSON.stringify(layout) !== savedLayout;

  const [preview, setPreview] = useState<AttributeValues>(() => initialValues(initialFields));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (i: number, patch: Partial<CategoryFieldConfig>) => setLayout((l) => l.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const move = (from: number, to: number) =>
    setLayout((l) => {
      if (to < 0 || to >= l.length || from === to) return l;
      const next = [...l];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  const remove = (i: number) => {
    const field = resolved[i];
    const dependents = resolved.filter((f) => f.condition?.fieldKey === field.key);
    if (dependents.length && !window.confirm(`${dependents.map((d) => `"${d.label}"`).join(", ")} only show based on "${field.label}". Remove it and drop those rules?`)) return;
    setLayout((l) => l.filter((_, j) => j !== i).map((c) => (dependents.some((d) => d.id === c.fieldId) ? { ...c, condition: null } : c)));
  };

  const add = (f: FieldDefinition) => {
    setLayout((l) => [...l, { fieldId: f.id, required: false, showOnCard: false, condition: null }]);
    if (f.defaultValue != null) setPreview((p) => ({ ...p, [f.key]: f.defaultValue as FieldValue }));
  };

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      await api(`/api/categories/${category.id}/fields`, { method: "PUT", body: { fields: layout } });
      setSavedLayout(JSON.stringify(layout));
      setStatus({ tone: "ok", text: category.isActive ? "Saved. Sellers see the new form right away." : "Saved. Turn on “Open to sellers” when you're ready." });
      router.refresh();
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof ApiError ? e.message : "Couldn't save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory() {
    if (!window.confirm(`Delete "${category.name}"? This can't be undone.`)) return;
    try {
      await api(`/api/categories/${category.id}`, { method: "DELETE" });
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof ApiError ? e.message : "Couldn't delete the category." });
    }
  }

  const available = library.filter((f) => !f.archived && !layout.some((c) => c.fieldId === f.id));

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> All categories
      </Link>

      {/* Category details */}
      <Card className="p-5 sm:p-6">
        {editingDetails ? (
          <CategoryDetailsForm
            category={category}
            submitLabel="Save details"
            onCancel={() => setEditingDetails(false)}
            onSaved={(c) => {
              setCategory(c);
              setEditingDetails(false);
              router.refresh();
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
              <CategoryIcon name={category.icon} className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{category.name}</h2>
                {category.isActive ? <Badge tone="brand">Open to sellers</Badge> : <Badge tone="warn">Draft · hidden from sellers</Badge>}
              </div>
              <p className="text-sm text-ink-3">{category.description ?? `/sell/${category.slug}`}</p>
            </div>
            <div className="flex gap-2">
              {category.isActive && (
                <Link href={`/sell/${category.slug}`} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-2 hover:bg-ink/5">
                  <ExternalLink className="size-3.5" /> Seller view
                </Link>
              )}
              <Button variant="secondary" size="sm" onClick={() => setEditingDetails(true)}>
                <Pencil className="size-3.5" /> Edit details
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Field arrangement */}
        <section aria-labelledby="fields-heading" className="min-w-0 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="fields-heading" className="text-lg font-semibold tracking-tight">
                Category fields
              </h2>
              <p className="text-sm text-ink-3">Shown after the common fields (title, price, condition, photos, description). Drag to reorder.</p>
            </div>
          </div>

          {resolved.length === 0 && !picking && (
            <EmptyState title="No fields yet">Add fields from the library; sellers will answer them in this order.</EmptyState>
          )}

          <ol className="space-y-2">
            {resolved.map((f, i) => {
              const controller = f.condition ? resolved.find((x) => x.key === f.condition!.fieldKey) : undefined;
              const rowProblem = problems.find((p) => p.startsWith(`"${f.label}"`));
              return (
                <li
                  key={f.id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null && dragIndex !== i) {
                      move(dragIndex, i);
                      setDragIndex(i);
                    }
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={cn(
                    "rounded-[12px] border bg-surface transition-shadow",
                    dragIndex === i ? "border-brand shadow-[var(--shadow-pop)]" : rowProblem ? "border-danger" : "border-line",
                    f.condition && "ml-6",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                    <GripVertical className="size-4 shrink-0 cursor-grab text-ink-3" aria-hidden />
                    <div className="min-w-[12rem] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{f.label}</span>
                        <Badge>{FIELD_TYPE_REGISTRY[f.type].label}</Badge>
                      </div>
                      <code className="font-mono text-xs text-ink-3">{f.key}</code>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="flex items-center gap-1.5 text-[13px] text-ink-2" title={f.type === "checkbox" ? "A toggle always has an answer" : undefined}>
                      <Switch checked={f.required} disabled={f.type === "checkbox"} onChange={(v) => update(i, { required: v })} label={`${f.label} required`} />
                      Required
                    </label>
                    <label className="flex items-center gap-1.5 text-[13px] text-ink-2" title="Show this value on product cards">
                      <Switch checked={f.showOnCard} onChange={(v) => update(i, { showOnCard: v })} label={`Show ${f.label} on cards`} />
                      On card
                    </label>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("px-2", f.condition && "text-brand")}
                        onClick={() => setRuleOpen(ruleOpen === f.id ? null : f.id)}
                        aria-label={`Visibility rule for ${f.label}`}
                        title="Show only when…"
                        disabled={i === 0 && !f.condition}
                      >
                        <GitBranch className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="px-2" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${f.label} up`}>
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="px-2" onClick={() => move(i, i + 1)} disabled={i === resolved.length - 1} aria-label={`Move ${f.label} down`}>
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="px-2" onClick={() => setEditingField(byId.get(f.id)!)} aria-label={`Edit field ${f.label}`}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="danger" size="sm" className="px-2" onClick={() => remove(i)} aria-label={`Remove ${f.label}`}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    </div>
                  </div>
                  {f.condition && ruleOpen !== f.id && (
                    <button type="button" onClick={() => setRuleOpen(f.id)} className="flex w-full items-center gap-1.5 border-t border-line px-3 py-2 text-left text-[13px] text-brand hover:bg-brand-soft/40">
                      <GitBranch className="size-3.5" /> Shows only when {describeCondition(f.condition, controller)}
                    </button>
                  )}
                  {ruleOpen === f.id && (
                    <RuleEditor
                      candidates={resolved.slice(0, i)}
                      condition={f.condition}
                      onChange={(condition) => update(i, { condition })}
                      onClose={() => setRuleOpen(null)}
                    />
                  )}
                  {rowProblem && <p className="border-t border-danger/30 px-3 py-2 text-[13px] text-danger">{rowProblem.replace(`"${f.label}"`, "This field")}</p>}
                </li>
              );
            })}
          </ol>

          {picking ? (
            <FieldPicker
              available={available}
              onPick={(f) => add(f)}
              onCreate={() => setEditingField("new")}
              onClose={() => setPicking(false)}
            />
          ) : (
            <Button variant="secondary" onClick={() => setPicking(true)} className="w-full border-dashed">
              <Plus className="size-4" /> Add field
            </Button>
          )}

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-surface/95 px-4 py-3 shadow-[var(--shadow-pop)] backdrop-blur">
            <p className="flex min-w-0 items-center gap-1.5 text-sm">
              {problems.length ? (
                <span className="flex items-center gap-1.5 text-danger">
                  <CircleAlert className="size-4 shrink-0" /> {problems.length} problem{problems.length === 1 ? "" : "s"} to fix before saving
                </span>
              ) : status ? (
                <span className={cn("flex items-center gap-1.5", status.tone === "ok" ? "text-brand" : "text-danger")}>
                  {status.tone === "ok" ? <CircleCheck className="size-4 shrink-0" /> : <CircleAlert className="size-4 shrink-0" />}
                  {status.text}
                </span>
              ) : dirty ? (
                <span className="text-ink-2">Unsaved changes</span>
              ) : (
                <span className="text-ink-3">All changes saved</span>
              )}
            </p>
            <div className="flex gap-2">
              {dirty && (
                <Button variant="ghost" size="sm" onClick={() => setLayout(JSON.parse(savedLayout))}>
                  <RotateCcw className="size-3.5" /> Discard
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={!dirty || saving || problems.length > 0}>
                {saving && <LoaderCircle className="size-3.5 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>

          <div className="pt-6">
            <Button variant="danger" size="sm" onClick={deleteCategory}>
              <Trash2 className="size-3.5" /> Delete category
            </Button>
          </div>
        </section>

        {/* Live preview */}
        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Seller preview</h2>
              <p className="text-sm text-ink-3">Try it: answers here aren&apos;t saved.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPreview(initialValues(resolved))}>
              <RotateCcw className="size-3.5" /> Reset
            </Button>
          </div>
          <Card className="max-h-[calc(100dvh-12rem)] overflow-y-auto p-5">
            {resolved.length ? (
              <DynamicFields
                fields={resolved}
                values={preview}
                idPrefix="preview"
                showRuleHints
                onChange={(k, v) =>
                  setPreview((p) => {
                    const next = { ...p };
                    if (v === undefined) delete next[k];
                    else next[k] = v;
                    return next;
                  })
                }
              />
            ) : (
              <p className="text-sm text-ink-3">Fields you add appear here exactly as sellers will see them.</p>
            )}
          </Card>
        </aside>
      </div>

      {editingField && (
        <FieldEditor
          field={editingField === "new" ? undefined : editingField}
          listingCount={editingField === "new" ? 0 : editingField.listingCount}
          onClose={() => setEditingField(null)}
          onSaved={(saved) => {
            const existing = byId.get(saved.id);
            const merged: FieldWithUsage = { ...saved, archived: false, categories: existing?.categories ?? [], listingCount: existing?.listingCount ?? 0 };
            setLibrary((lib) => (existing ? lib.map((f) => (f.id === saved.id ? merged : f)) : [...lib, merged]));
            if (!existing) add(saved);
            setEditingField(null);
          }}
        />
      )}
    </div>
  );
}

function FieldPicker({ available, onPick, onCreate, onClose }: { available: FieldWithUsage[]; onPick: (f: FieldWithUsage) => void; onCreate: () => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const shown = available.filter((f) => !q || f.label.toLowerCase().includes(q.toLowerCase()) || f.key.includes(q.toLowerCase()));
  return (
    <Card className="animate-reveal overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Search className="size-4 text-ink-3" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the field library" aria-label="Search the field library" className="h-9 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
        <Button variant="ghost" size="sm" className="px-2" onClick={onClose} aria-label="Close picker">
          <X className="size-4" />
        </Button>
      </div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto">
        {shown.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => onPick(f)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-canvas">
              <Plus className="size-4 text-ink-3" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{f.label}</span>
                <span className="block truncate text-xs text-ink-3">
                  {FIELD_TYPE_REGISTRY[f.type].label}
                  {f.categories.length > 0 && ` · used in ${f.categories.map((c) => c.name).join(", ")}`}
                </span>
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-3 text-sm text-ink-3">{q ? `No library field matches “${q}”.` : "Every library field is already in this category."}</li>}
      </ul>
      <button type="button" onClick={onCreate} className="flex w-full items-center gap-2 border-t border-line bg-canvas px-4 py-3 text-sm font-medium text-brand hover:bg-brand-soft/50">
        <Plus className="size-4" /> Create a new field
      </button>
    </Card>
  );
}

const OPERATORS_FOR = (f: ResolvedField): ConditionOperator[] =>
  f.options.length ? ["equals", "notEquals", "in", "isFilled", "isEmpty"] : f.type === "checkbox" ? ["equals"] : ["equals", "notEquals", "isFilled", "isEmpty"];

function RuleEditor({
  candidates,
  condition,
  onChange,
  onClose,
}: {
  candidates: ResolvedField[];
  condition: VisibilityCondition | null;
  onChange: (c: VisibilityCondition | null) => void;
  onClose: () => void;
}) {
  const controller = candidates.find((c) => c.key === condition?.fieldKey);
  const values = Array.isArray(condition?.value) ? condition.value : condition?.value != null ? [condition.value] : [];

  const pickController = (key: string) => {
    const c = candidates.find((x) => x.key === key);
    if (!c) return onChange(null);
    onChange({ fieldKey: key, operator: "equals", value: c.type === "checkbox" ? "true" : c.options[0]?.value ?? "" });
  };
  const setOperator = (operator: ConditionOperator) => {
    if (!condition) return;
    const value = !operatorNeedsValue(operator) ? undefined : operator === "in" ? values : values[0] ?? "";
    onChange({ ...condition, operator, value });
  };
  const toggleValue = (v: string) => {
    if (!condition) return;
    if (condition.operator === "in") onChange({ ...condition, value: values.includes(v) ? values.filter((x) => x !== v) : [...values, v] });
    else onChange({ ...condition, value: v });
  };

  return (
    <div className="space-y-3 border-t border-line bg-canvas/60 px-3 py-3">
      <p className="text-[13px] font-medium text-ink-2">Show this field only when</p>
      {candidates.length === 0 ? (
        <p className="text-[13px] text-ink-3">Rules can only depend on fields above this one. Move it down first.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Controlling field" value={condition?.fieldKey ?? ""} onChange={(e) => pickController(e.target.value)} className="h-9 w-auto min-w-44 text-sm">
            <option value="">Always show</option>
            {candidates.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
          {condition && controller && (
            <>
              <Select aria-label="Operator" value={condition.operator} onChange={(e) => setOperator(e.target.value as ConditionOperator)} className="h-9 w-auto min-w-32 text-sm">
                {OPERATORS_FOR(controller).map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </Select>
              {operatorNeedsValue(condition.operator) &&
                (controller.options.length || controller.type === "checkbox" ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(controller.type === "checkbox" ? [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] : controller.options).map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={values.includes(o.value)}
                        onClick={() => toggleValue(o.value)}
                        className={cn(
                          "h-8 rounded-full border px-3 text-[13px]",
                          values.includes(o.value) ? "border-brand bg-brand-soft text-brand-ink" : "border-line-2 bg-surface text-ink-2",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    aria-label="Value"
                    value={values[0] ?? ""}
                    onChange={(e) => onChange({ ...condition, value: e.target.value })}
                    className="h-9 rounded-[10px] border border-line-2 bg-surface px-3 text-sm"
                  />
                ))}
            </>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        {condition && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Remove rule
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
