"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert, ImageOff, ImagePlus, LoaderCircle, MapPin, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { visibleFieldKeys } from "@/lib/fields/conditions";
import { formatFieldValue, isEmptyValue } from "@/lib/fields/registry";
import type { AttributeValues, FieldValue, ResolvedField } from "@/lib/fields/types";
import { initialValues, validateAttributes } from "@/lib/fields/validate";
import { commonListingSchema, CONDITIONS, conditionLabel, formatPrice, MAX_IMAGES } from "@/lib/listing";
import { DynamicFields } from "../fields/DynamicFields";
import { CategoryIcon } from "../CategoryIcon";
import { Button, Card, cn, FieldShell, Input, Textarea } from "../ui";

interface Props {
  category: { id: number; name: string; slug: string; icon: string };
  fields: ResolvedField[];
}

interface Common {
  title: string;
  description: string;
  price: number | undefined;
  condition: string;
  location: string;
  sellerName: string;
  images: string[];
}

const EMPTY_COMMON: Common = { title: "", description: "", price: undefined, condition: "", location: "", sellerName: "", images: [] };

type Errors = Record<string, string>;

function validateAll(common: Common, fields: ResolvedField[], attrs: AttributeValues) {
  const commonErrors: Errors = {};
  const parsed = commonListingSchema.safeParse(common);
  if (!parsed.success) for (const i of parsed.error.issues) commonErrors[String(i.path[0])] ??= i.message;
  const attrResult = validateAttributes(fields, attrs);
  return { commonErrors, attrErrors: attrResult.errors, ok: parsed.success && attrResult.ok };
}

export function SellForm({ category, fields }: Props) {
  const router = useRouter();
  const draftKey = `circle:sell-draft:${category.slug}`;
  const [common, setCommon] = useState<Common>(EMPTY_COMMON);
  const [attrs, setAttrs] = useState<AttributeValues>(() => initialValues(fields));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<{ common: Errors; attrs: Errors }>({ common: {}, attrs: {} });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const hydrated = useRef(false);

  // Restore an unfinished draft for this category, then keep it saved as the seller types.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (saved?.common) {
        setCommon({ ...EMPTY_COMMON, ...saved.common });
        setAttrs({ ...initialValues(fields), ...saved.attrs });
        setDraftRestored(true);
      }
    } catch {}
    hydrated.current = true;
  }, [draftKey, fields]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      // Only keep a draft once the seller has actually typed something.
      const untouched = JSON.stringify(common) === JSON.stringify(EMPTY_COMMON) && JSON.stringify(attrs) === JSON.stringify(initialValues(fields));
      if (untouched) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({ common, attrs }));
    } catch {}
  }, [draftKey, common, attrs, fields]);

  const discardDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    setCommon(EMPTY_COMMON);
    setAttrs(initialValues(fields));
    setTouched(new Set());
    setSubmitted(false);
    setDraftRestored(false);
  };

  const live = useMemo(() => validateAll(common, fields, attrs), [common, fields, attrs]);
  const show = (key: string) => submitted || touched.has(key);
  const commonError = (k: keyof Common) => serverErrors.common[k] ?? (show(k) ? live.commonErrors[k] : undefined);
  const attrErrors: Errors = {};
  for (const [k, v] of Object.entries(live.attrErrors)) if (show(`attr:${k}`)) attrErrors[k] = v;
  Object.assign(attrErrors, serverErrors.attrs);

  const touch = (key: string) => setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));
  const setField = <K extends keyof Common>(k: K, v: Common[K]) => {
    setCommon((c) => ({ ...c, [k]: v }));
    setServerErrors((e) => ({ ...e, common: { ...e.common, [k]: undefined as never } }));
  };
  const setAttr = (key: string, value: FieldValue | undefined) => {
    setAttrs((a) => {
      const next = { ...a };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
    setServerErrors((e) => {
      const { [key]: _drop, ...rest } = e.attrs;
      return { ...e, attrs: rest };
    });
  };

  // Progress counts only fields currently visible, so it never asks for hidden answers.
  const visible = visibleFieldKeys(fields, attrs);
  const requiredAttrs = fields.filter((f) => f.required && f.type !== "checkbox" && visible.has(f.key));
  const commonRequired: (keyof Common)[] = ["title", "condition", "price", "description", "location", "sellerName"];
  const total = commonRequired.length + requiredAttrs.length;
  const done =
    commonRequired.filter((k) => !isEmptyValue(common[k]) && !live.commonErrors[k]).length +
    requiredAttrs.filter((f) => !isEmptyValue(attrs[f.key]) && !live.attrErrors[f.key]).length;

  const highlights = fields
    .filter((f) => f.showOnCard && visible.has(f.key) && !isEmptyValue(attrs[f.key]) && !live.attrErrors[f.key])
    .map((f) => formatFieldValue(attrs[f.key], f));

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (!live.ok) {
      setFormError("A few things need your attention before publishing.");
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setBusy(true);
    try {
      const { id } = await api<{ id: number }>("/api/listings", { body: { ...common, categoryId: category.id, attributes: attrs } });
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      router.push(`/listings/${id}?published=1`);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError) {
        const next = { common: {} as Errors, attrs: {} as Errors };
        for (const [path, msg] of Object.entries(err.fieldErrors)) {
          if (path.startsWith("attributes.")) next.attrs[path.slice("attributes.".length)] = msg;
          else next.common[path] = msg;
        }
        setServerErrors(next);
        // The category may have changed since this page loaded (an admin added a required field).
        setFormError(err.status === 422 && Object.keys(err.fieldErrors).length ? `${err.message}. If a field looks new, the category was just updated.` : err.message);
      } else setFormError("Something went wrong. Please try again.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <Link href="/sell" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> Change category
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand">Step 2 of 2</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <CategoryIcon name={category.icon} className="size-7 text-ink-2" />
            Sell in {category.name}
          </h1>
        </div>
        {draftRestored && (
          <p className="text-sm text-ink-3">
            Picked up where you left off ·{" "}
            <button type="button" onClick={discardDraft} className="text-brand hover:underline">
              Start over
            </button>
          </p>
        )}
      </div>

      <form onSubmit={submit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Section n={1} title="The basics">
            <FieldShell id="title" label="Title" required error={commonError("title")} help="Brand, model and the one detail buyers search for.">
              <Input
                id="title"
                value={common.title}
                maxLength={80}
                placeholder={category.slug === "sofas" ? "e.g. 3-seater grey fabric sofa" : "e.g. iPhone 13, 128 GB, Midnight"}
                onChange={(e) => setField("title", e.target.value)}
                onBlur={() => touch("title")}
                invalid={!!commonError("title")}
              />
            </FieldShell>
            <FieldShell id="condition" label="Condition" required error={commonError("condition")}>
              <div id="condition" role="radiogroup" aria-invalid={!!commonError("condition") || undefined} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={common.condition === c.value}
                    onClick={() => {
                      setField("condition", c.value);
                      touch("condition");
                    }}
                    className={cn(
                      "rounded-[10px] border px-3 py-2.5 text-left transition-colors",
                      common.condition === c.value ? "border-brand bg-brand-soft" : "border-line-2 bg-surface hover:border-ink-3",
                    )}
                  >
                    <span className="block text-sm font-medium">{c.label}</span>
                    <span className="block text-xs text-ink-3">{c.hint}</span>
                  </button>
                ))}
              </div>
            </FieldShell>
            <FieldShell id="price" label="Price" required error={commonError("price")}>
              <div className="relative max-w-56">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-3">₹</span>
                <Input
                  id="price"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={common.price ?? ""}
                  placeholder="0"
                  onChange={(e) => setField("price", e.target.value === "" ? undefined : Number(e.target.value))}
                  onWheel={(e) => e.currentTarget.blur()}
                  onBlur={() => touch("price")}
                  invalid={!!commonError("price")}
                  className="pl-7 tabular-nums"
                />
              </div>
            </FieldShell>
          </Section>

          <Section n={2} title={`${category.name.replace(/s$/, "")} details`} hint="Specific details help your listing show up in the right searches.">
            {fields.length ? (
              <DynamicFields fields={fields} values={attrs} errors={attrErrors} onChange={setAttr} onBlur={(k) => touch(`attr:${k}`)} />
            ) : (
              <p className="text-sm text-ink-3">No extra details needed for this category.</p>
            )}
          </Section>

          <Section n={3} title="Photos" hint={`Optional. Paste up to ${MAX_IMAGES} image links; the first one is the cover.`}>
            <ImagesInput images={common.images} onChange={(imgs) => setField("images", imgs)} error={serverErrors.common.images ?? (submitted ? live.commonErrors.images : undefined)} />
          </Section>

          <Section n={4} title="Description and contact">
            <FieldShell id="description" label="Description" required error={commonError("description")} help="How you used it, why you're selling, anything included.">
              <Textarea
                id="description"
                value={common.description}
                maxLength={2000}
                onChange={(e) => setField("description", e.target.value)}
                onBlur={() => touch("description")}
                invalid={!!commonError("description")}
              />
            </FieldShell>
            <div className="grid gap-5 sm:grid-cols-2">
              <FieldShell id="location" label="Location" required error={commonError("location")}>
                <Input id="location" value={common.location} placeholder="e.g. Indiranagar, Bengaluru" onChange={(e) => setField("location", e.target.value)} onBlur={() => touch("location")} invalid={!!commonError("location")} />
              </FieldShell>
              <FieldShell id="sellerName" label="Your name" required error={commonError("sellerName")}>
                <Input id="sellerName" value={common.sellerName} placeholder="Shown to buyers" onChange={(e) => setField("sellerName", e.target.value)} onBlur={() => touch("sellerName")} invalid={!!commonError("sellerName")} />
              </FieldShell>
            </div>
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Preview</p>
          <Card className="overflow-hidden">
            <div className="aspect-[4/3] bg-canvas">
              {common.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={common.images[0]} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-ink-3">
                  <CategoryIcon name={category.icon} className="size-10" />
                </div>
              )}
            </div>
            <div className="space-y-1 p-4">
              <p className="text-lg font-semibold tabular-nums">{common.price ? formatPrice(common.price) : <span className="text-ink-3">₹ —</span>}</p>
              <p className={cn("line-clamp-2 text-[15px]", !common.title && "text-ink-3")}>{common.title || "Your title"}</p>
              {highlights.length > 0 && <p className="truncate text-[13px] text-ink-2">{highlights.join(" · ")}</p>}
              <p className="flex items-center gap-1 pt-1 text-xs text-ink-3">
                <MapPin className="size-3" />
                {common.location || "Location"}
                {common.condition && <> · {conditionLabel(common.condition)}</>}
              </p>
            </div>
          </Card>

          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-ink-2">Required details</span>
              <span className="tabular-nums text-ink-3">
                {done} / {total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${total ? (done / total) * 100 : 100}%` }} />
            </div>
          </div>

          {formError && (
            <p role="alert" className="flex gap-2 rounded-[10px] bg-danger-soft px-3 py-2.5 text-sm text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {formError}
            </p>
          )}
          <Button type="submit" disabled={busy} className="h-12 w-full text-[15px]">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {busy ? "Publishing…" : "Publish listing"}
          </Button>
          <p className="text-center text-xs text-ink-3">Your progress is saved on this device until you publish.</p>
        </aside>
      </form>
    </main>
  );
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="flex size-6 items-center justify-center rounded-full bg-ink text-xs text-white">{n}</span>
          {title}
        </h2>
        {hint && <p className="mt-1 pl-[34px] text-sm text-ink-3">{hint}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </Card>
  );
}

function ImagesInput({ images, onChange, error }: { images: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());

  const add = () => {
    const url = draft.trim();
    if (!url) return;
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      setProblem("That doesn't look like an image link. It should start with https://");
      return;
    }
    if (images.includes(url)) return setProblem("You've already added this photo.");
    onChange([...images, url]);
    setDraft("");
    setProblem(null);
  };

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {images.map((src, i) => (
            <li key={src} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-canvas">
              {broken.has(src) ? (
                <div className="flex size-full flex-col items-center justify-center gap-1 p-1 text-center text-[11px] text-danger">
                  <ImageOff className="size-4" /> Can&apos;t load
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="size-full object-cover" onError={() => setBroken((b) => new Set(b).add(src))} />
              )}
              {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-ink/75 px-1.5 text-[10px] text-white">Cover</span>}
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(images.filter((x) => x !== src))}
                className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {images.length < MAX_IMAGES && (
        <div className="flex gap-2">
          <Input
            value={draft}
            type="url"
            aria-label="Image link"
            placeholder="https://… paste an image link"
            onChange={(e) => {
              setDraft(e.target.value);
              setProblem(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            invalid={!!problem}
          />
          <Button variant="secondary" onClick={add} className="h-11 shrink-0">
            <ImagePlus className="size-4" /> Add
          </Button>
        </div>
      )}
      {(problem || error) && <p className="text-[13px] text-danger">{problem ?? error}</p>}
    </div>
  );
}
