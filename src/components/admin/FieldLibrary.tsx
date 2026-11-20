"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Library, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { FIELD_TYPE_REGISTRY } from "@/lib/fields/registry";
import type { FieldWithUsage } from "@/server/services/fields";
import { Badge, Button, Card, EmptyState, Input, Switch } from "../ui";
import { FieldEditor } from "./FieldEditor";

export function FieldLibrary({ initialFields: fields }: { initialFields: FieldWithUsage[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<FieldWithUsage | "new" | null>(null);
  const [notice, setNotice] = useState<{ tone: "brand" | "danger"; text: string } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fields.filter((f) => (showArchived || !f.archived) && (!q || f.label.toLowerCase().includes(q) || f.key.includes(q)));
  }, [fields, query, showArchived]);
  const archivedCount = fields.filter((f) => f.archived).length;

  async function remove(f: FieldWithUsage) {
    const archiving = f.listingCount > 0;
    const ok = window.confirm(
      archiving
        ? `Archive "${f.label}"? ${f.listingCount} listing(s) keep showing their answers; it just can't be added to categories anymore.`
        : `Delete "${f.label}"? This can't be undone.`,
    );
    if (!ok) return;
    try {
      const { result } = await api<{ result: string }>(`/api/fields/${f.id}`, { method: "DELETE" });
      setNotice({ tone: "brand", text: `"${f.label}" ${result}.` });
      router.refresh();
    } catch (e) {
      setNotice({ tone: "danger", text: e instanceof ApiError ? e.message : "Couldn't delete the field." });
    }
  }

  async function restore(f: FieldWithUsage) {
    await api(`/api/fields/${f.id}`, { method: "PATCH", body: { restore: true } });
    setNotice({ tone: "brand", text: `"${f.label}" restored.` });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search fields" aria-label="Search fields" className="h-10 pl-9" />
          </div>
          {archivedCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <Switch checked={showArchived} onChange={setShowArchived} label="Show archived" />
              Show archived ({archivedCount})
            </label>
          )}
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> New field
        </Button>
      </div>

      {notice && (
        <p role="status" className={notice.tone === "danger" ? "rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger" : "rounded-[10px] bg-brand-soft px-3 py-2 text-sm text-brand-ink"}>
          {notice.text}
        </p>
      )}

      {visible.length ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-3">
                <th className="px-4 py-3 font-medium">Field</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Used in</th>
                <th className="px-4 py-3 text-right font-medium">Answers</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((f) => (
                <tr key={f.id} className={f.archived ? "opacity-60" : undefined}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      {f.label}
                      {f.unit && <span className="font-normal text-ink-3">({f.unit})</span>}
                      {f.archived && <Badge tone="warn">Archived</Badge>}
                    </div>
                    <code className="font-mono text-xs text-ink-3">{f.key}</code>
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {FIELD_TYPE_REGISTRY[f.type].label}
                    {f.options.length > 0 && <span className="text-ink-3"> · {f.options.length} options</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {f.categories.length ? f.categories.map((c) => <Badge key={c.id}>{c.name}</Badge>) : <span className="text-ink-3">Not used</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-2">{f.listingCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {f.archived ? (
                        <Button variant="ghost" size="sm" onClick={() => restore(f)}>
                          <ArchiveRestore className="size-3.5" /> Restore
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setEditing(f)} aria-label={`Edit ${f.label}`}>
                            <Pencil className="size-3.5" /> Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => remove(f)}
                            aria-label={`${f.listingCount ? "Archive" : "Delete"} ${f.label}`}
                            title={f.categories.length ? "Remove it from its categories first" : undefined}
                          >
                            {f.listingCount ? <Archive className="size-3.5" /> : <Trash2 className="size-3.5" />}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState icon={<Library className="size-8" />} title={query ? "No fields match" : "The library is empty"}>
          {query ? "Try another word, or create a new field." : "Create a field, then add it to categories."}
        </EmptyState>
      )}

      {editing && (
        <FieldEditor
          field={editing === "new" ? undefined : editing}
          listingCount={editing === "new" ? 0 : editing.listingCount}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setNotice({ tone: "brand", text: `"${saved.label}" saved.` });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
