"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, LayoutGrid, Plus } from "lucide-react";
import type { CategorySummary } from "@/server/services/categories";
import { CategoryIcon } from "../CategoryIcon";
import { Badge, Button, Card, EmptyState } from "../ui";
import { CategoryDetailsForm } from "./CategoryDetailsForm";

export function CategoryList({ categories }: { categories: CategorySummary[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          Each category picks its questions from the shared field library. Sellers only ever see the fields you configure here, no code changes needed.
        </p>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New category
          </Button>
        )}
      </div>

      {creating && (
        <Card className="animate-reveal p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">New category</h2>
          <CategoryDetailsForm
            submitLabel="Create and add fields"
            onCancel={() => setCreating(false)}
            onSaved={(c) => router.push(`/admin/categories/${c.id}?new=1`)}
          />
        </Card>
      )}

      {categories.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {categories.map((c) => (
            <Link key={c.id} href={`/admin/categories/${c.id}`} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-canvas sm:px-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <CategoryIcon name={c.icon} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.isActive ? <Badge tone="brand">Live</Badge> : <Badge tone="warn">Draft</Badge>}
                </span>
                <span className="block truncate text-sm text-ink-3">{c.description ?? `/${c.slug}`}</span>
              </span>
              <span className="hidden text-right text-sm text-ink-2 sm:block">
                <span className="tabular-nums">{c.fieldCount}</span> fields
                <span className="mx-2 text-line-2">|</span>
                <span className="tabular-nums">{c.listingCount}</span> listings
              </span>
              <ChevronRight className="size-4 text-ink-3 transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<LayoutGrid className="size-8" />} title="No categories yet">
          Create one, then add fields to it from the library.
        </EmptyState>
      )}
    </div>
  );
}
