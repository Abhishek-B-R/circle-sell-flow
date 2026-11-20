"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CircleAlert, LoaderCircle, Lock, Plus, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { slugifyKey } from "@/lib/fields/definition-schema";
import { FIELD_TYPE_REGISTRY } from "@/lib/fields/registry";
import { FIELD_TYPES, type FieldDefinition, type FieldOption, type FieldType, type FieldValidation, type FieldValue } from "@/lib/fields/types";
import { FIELD_INPUTS } from "../fields/inputs";
import { Button, cn, FieldShell, Input, Switch } from "../ui";

interface Props {
  /** Editing an existing field when set; creating a new one otherwise. */
  field?: FieldDefinition;
  /** Listings that hold answers for this field: its type is locked when > 0. */
  listingCount?: number;
  onSaved: (field: FieldDefinition) => void;
  onClose: () => void;
}

type Draft = Omit<FieldDefinition, "id">;

const blank: Draft = { key: "", label: "", type: "text", helpText: null, placeholder: null, unit: null, options: [], validation: {}, defaultValue: null };

const numberOrUndefined = (s: string) => (s.trim() === "" ? undefined : Number(s));

/** Right-hand drawer to create or edit a reusable field definition. */
export function FieldEditor({ field, listingCount = 0, onSaved, onClose }: Props) {
  const isNew = !field;
  const [draft, setDraft] = useState<Draft>(() => (field ? { ...field } : blank));
  const [keyTouched, setKeyTouched] = useState(!isNew);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const spec = FIELD_TYPE_REGISTRY[draft.type];
  const typeLocked = !isNew && listingCount > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setRule = (k: keyof FieldValidation, v: FieldValidation[keyof FieldValidation]) =>
    setDraft((d) => {
      const validation = { ...d.validation, [k]: v };
      if (v === undefined || v === false) delete validation[k];
      return { ...d, validation };
    });

  const changeType = (type: FieldType) =>
    setDraft((d) => ({
      ...d,
      type,
      defaultValue: null,
      options: FIELD_TYPE_REGISTRY[type].supports.options && d.options.length === 0 ? [{ value: "", label: "" }, { value: "", label: "" }] : d.options,
    }));

  // The default-value input is the real seller input for this field, so admins see exactly what sellers get.
  const previewField = useMemo(
    () => ({ id: 0, ...draft, options: draft.options.filter((o) => o.value), required: false, showOnCard: false, condition: null }),
    [draft],
  );
  const DefaultInput = FIELD_INPUTS[draft.type];

  async function save(e: React.SyntheticEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const body = { ...draft, options: spec.supports.options ? draft.options : [] };
      const saved = isNew
        ? await api<FieldDefinition>("/api/fields", { body })
        : await api<FieldDefinition>(`/api/fields/${field.id}`, { method: "PATCH", body });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setFormError(Object.keys(err.fieldErrors).length ? "Please fix the highlighted settings." : err.message);
      } else setFormError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const err = (path: string) => errors[path] ?? Object.entries(errors).find(([k]) => k.startsWith(`${path}.`))?.[1];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="field-editor-title">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <form onSubmit={save} noValidate className="relative flex h-full w-full max-w-xl flex-col bg-surface shadow-[var(--shadow-pop)]">
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id="field-editor-title" className="text-lg font-semibold tracking-tight">
              {isNew ? "New field" : `Edit “${field.label}”`}
            </h2>
            <p className="text-sm text-ink-3">{isNew ? "Fields are reusable: add it to as many categories as you like." : "Changes apply to new listings. Published listings keep what the seller saw."}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell id="fe-label" label="Label" required error={err("label")}>
              <Input
                id="fe-label"
                autoFocus
                value={draft.label}
                placeholder="e.g. Battery health"
                onChange={(e) => {
                  const label = e.target.value;
                  setDraft((d) => ({ ...d, label, key: keyTouched ? d.key : slugifyKey(label) }));
                }}
                invalid={!!err("label")}
              />
            </FieldShell>
            <FieldShell
              id="fe-key"
              label="Key"
              required
              error={err("key")}
              help={isNew ? "Stored on listings. Can't change later." : "Locked: listings store answers under it."}
            >
              <Input
                id="fe-key"
                value={draft.key}
                disabled={!isNew}
                onChange={(e) => {
                  setKeyTouched(true);
                  set("key", e.target.value.toLowerCase());
                }}
                invalid={!!err("key")}
                className="font-mono text-sm"
              />
            </FieldShell>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              Type
              {typeLocked && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-ink-3">
                  <Lock className="size-3" /> locked, {listingCount} listing{listingCount === 1 ? "" : "s"} use it
                </span>
              )}
            </p>
            <div role="radiogroup" aria-label="Field type" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FIELD_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={draft.type === t}
                  disabled={typeLocked && draft.type !== t}
                  onClick={() => changeType(t)}
                  className={cn(
                    "rounded-[10px] border px-3 py-2 text-left transition-colors disabled:opacity-40",
                    draft.type === t ? "border-brand bg-brand-soft" : "border-line-2 hover:border-ink-3",
                  )}
                >
                  <span className="block text-sm font-medium">{FIELD_TYPE_REGISTRY[t].label}</span>
                  <span className="block text-xs leading-snug text-ink-3">{FIELD_TYPE_REGISTRY[t].description}</span>
                </button>
              ))}
            </div>
          </div>

          {spec.supports.options && <OptionsEditor options={draft.options} onChange={(o) => set("options", o)} error={err("options")} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldShell id="fe-help" label="Help text" help="Shown under the input. Explain where to find the answer." error={err("helpText")}>
                <Input id="fe-help" value={draft.helpText ?? ""} onChange={(e) => set("helpText", e.target.value)} />
              </FieldShell>
            </div>
            {spec.supports.placeholder && (
              <FieldShell id="fe-placeholder" label="Placeholder" error={err("placeholder")}>
                <Input id="fe-placeholder" value={draft.placeholder ?? ""} onChange={(e) => set("placeholder", e.target.value)} />
              </FieldShell>
            )}
            {spec.supports.unit && (
              <FieldShell id="fe-unit" label="Unit" help="e.g. GB, %, cm" error={err("unit")}>
                <Input id="fe-unit" value={draft.unit ?? ""} onChange={(e) => set("unit", e.target.value)} />
              </FieldShell>
            )}
          </div>

          <ValidationEditor type={draft.type} v={draft.validation} setRule={setRule} err={err} />

          <FieldShell id="fe-default" label="Default value" help="Pre-filled for sellers. Leave empty for none." error={err("defaultValue")}>
            <DefaultInput
              id="fe-default"
              field={previewField}
              value={draft.defaultValue ?? undefined}
              onChange={(v: FieldValue | undefined) => set("defaultValue", v ?? null)}
              invalid={!!err("defaultValue")}
            />
          </FieldShell>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <p className="min-w-0 text-sm text-danger" role="alert">
            {formError && (
              <span className="flex items-center gap-1.5">
                <CircleAlert className="size-4 shrink-0" /> {formError}
              </span>
            )}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {isNew ? "Create field" : "Save field"}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function OptionsEditor({ options, onChange, error }: { options: FieldOption[]; onChange: (o: FieldOption[]) => void; error?: string }) {
  const update = (i: number, patch: Partial<FieldOption>) => onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...options];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Options</p>
      <ul className="space-y-2">
        {options.map((o, i) => (
          <li key={i} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
            <Input
              aria-label={`Option ${i + 1} label`}
              value={o.label}
              placeholder={`Option ${i + 1}`}
              onChange={(e) => {
                const label = e.target.value;
                // Derive the stored value from the label until someone edits it directly.
                const auto = !o.value || o.value === slugifyKey(o.label).replace(/^f_/, "");
                update(i, { label, value: auto ? slugifyKey(label).replace(/^f_/, "") : o.value });
              }}
              className="h-10"
            />
            </div>
            <div className="w-32 shrink-0">
              <Input
                aria-label={`Option ${i + 1} stored value`}
                value={o.value}
                placeholder="value"
                onChange={(e) => update(i, { value: e.target.value.toLowerCase() })}
                className="h-10 font-mono text-xs text-ink-3"
              />
            </div>
            <div className="flex shrink-0">
              <Button variant="ghost" size="sm" className="px-2" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                <ArrowUp className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="px-2" disabled={i === options.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                <ArrowDown className="size-3.5" />
              </Button>
              <Button variant="danger" size="sm" className="px-2" onClick={() => onChange(options.filter((_, j) => j !== i))} aria-label="Remove option">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange([...options, { value: "", label: "" }])}>
        <Plus className="size-3.5" /> Add option
      </Button>
      <p className="mt-1 text-[13px] text-ink-3">The grey value is what listings store. Labels can be renamed any time.</p>
      {error && <p className="mt-1 text-[13px] text-danger">{error}</p>}
    </div>
  );
}

function ValidationEditor({
  type,
  v,
  setRule,
  err,
}: {
  type: FieldType;
  v: FieldValidation;
  setRule: (k: keyof FieldValidation, value: FieldValidation[keyof FieldValidation]) => void;
  err: (path: string) => string | undefined;
}) {
  const s = FIELD_TYPE_REGISTRY[type].supports;
  if (!s.length && !s.range && !s.items && !s.dates) return null;

  const num = (k: keyof FieldValidation, label: string) => (
    <FieldShell id={`fe-${k}`} label={label} error={err(`validation.${k}`)}>
      <Input
        id={`fe-${k}`}
        type="number"
        value={v[k] === undefined ? "" : String(v[k])}
        onChange={(e) => setRule(k, numberOrUndefined(e.target.value))}
        className="tabular-nums"
      />
    </FieldShell>
  );

  const date = (k: "minDate" | "maxDate", label: string) => {
    const isToday = v[k] === "today";
    return (
      <FieldShell id={`fe-${k}`} label={label} error={err(`validation.${k}`)}>
        <div className="space-y-2">
          <Input id={`fe-${k}`} type="date" value={isToday ? "" : (v[k] ?? "")} disabled={isToday} onChange={(e) => setRule(k, e.target.value || undefined)} />
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <Switch checked={isToday} onChange={(on) => setRule(k, on ? "today" : undefined)} label={`${label} is today`} />
            Always today
          </label>
        </div>
      </FieldShell>
    );
  };

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Validation</p>
      <div className="grid gap-4 rounded-[10px] bg-canvas p-4 sm:grid-cols-2">
        {s.length && (
          <>
            {num("minLength", "Min characters")}
            {num("maxLength", "Max characters")}
          </>
        )}
        {s.range && (
          <>
            {num("min", "Minimum")}
            {num("max", "Maximum")}
            {type === "number" && (
              <label className="flex items-center gap-2 text-sm text-ink-2 sm:col-span-2">
                <Switch checked={!!v.integer} onChange={(on) => setRule("integer", on || undefined)} label="Whole numbers only" />
                Whole numbers only
              </label>
            )}
          </>
        )}
        {s.items && (
          <>
            {num("minItems", "Min picks")}
            {num("maxItems", "Max picks")}
          </>
        )}
        {s.dates && (
          <>
            {date("minDate", "Earliest date")}
            {date("maxDate", "Latest date")}
          </>
        )}
      </div>
      <p className="mt-1.5 text-[13px] text-ink-3">Whether a field is required is set per category, in the category builder.</p>
    </div>
  );
}
