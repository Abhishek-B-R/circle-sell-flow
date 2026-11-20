"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { CATEGORY_ICONS } from "@/lib/fields/definition-schema";
import type { Category } from "@/server/db/schema";
import { CategoryIcon } from "../CategoryIcon";
import { Button, cn, FieldShell, Input, Switch } from "../ui";

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

interface Props {
  category?: Category;
  submitLabel: string;
  onSaved: (c: Category) => void;
  onCancel?: () => void;
}

/** Name, URL slug, description, icon and visibility. Used to create and to edit. */
export function CategoryDetailsForm({ category, submitLabel, onSaved, onCancel }: Props) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!category);
  const [description, setDescription] = useState(category?.description ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "package");
  const [isActive, setIsActive] = useState(category?.isActive ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    const body = { name, slug, description, icon, isActive };
    try {
      const saved = category
        ? await api<Category>(`/api/categories/${category.id}`, { method: "PATCH", body })
        : await api<Category>("/api/categories", { body });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) setFormError(err.message);
      } else setFormError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldShell id="cat-name" label="Name" required error={errors.name}>
          <Input
            id="cat-name"
            autoFocus={!category}
            value={name}
            placeholder="e.g. Headphones"
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(toSlug(e.target.value));
            }}
            invalid={!!errors.name}
          />
        </FieldShell>
        <FieldShell id="cat-slug" label="URL slug" required error={errors.slug} help={`circle.app/sell/${slug || "…"}`}>
          <Input
            id="cat-slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            invalid={!!errors.slug}
            className="font-mono text-sm"
          />
        </FieldShell>
      </div>
      <FieldShell id="cat-desc" label="Short description" error={errors.description} help="Shown to sellers when picking a category.">
        <Input id="cat-desc" value={description} maxLength={160} onChange={(e) => setDescription(e.target.value)} />
      </FieldShell>
      <div>
        <p className="mb-2 text-sm font-medium">Icon</p>
        <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-1.5">
          {CATEGORY_ICONS.map((name) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={icon === name}
              aria-label={name}
              onClick={() => setIcon(name)}
              className={cn(
                "flex size-10 items-center justify-center rounded-lg border transition-colors",
                icon === name ? "border-brand bg-brand-soft text-brand-ink" : "border-line-2 text-ink-2 hover:border-ink-3",
              )}
            >
              <CategoryIcon name={name} className="size-5" />
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-start gap-3">
        <span className="pt-0.5">
          <Switch checked={isActive} onChange={setIsActive} label="Open to sellers" />
        </span>
        <span>
          <span className="block text-sm font-medium">Open to sellers</span>
          <span className="block text-[13px] text-ink-3">Keep it off while you set up fields. Turning it off later hides it from sellers but keeps existing listings.</span>
        </span>
      </label>
      {formError && <p className="text-sm text-danger">{formError}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
