import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { EmptyState } from "@/components/ui";
import { getDb } from "@/server/db";
import { listCategories } from "@/server/services/categories";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sell an item" };

export default async function SellPage() {
  const categories = await listCategories(await getDb());
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      <p className="text-sm font-medium text-brand">Step 1 of 2</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">What are you selling?</h1>
      <p className="mt-2 text-ink-2">Pick a category. We&apos;ll only ask what buyers in that category care about.</p>

      {categories.length ? (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/sell/${c.slug}`}
                className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition hover:border-ink-3"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                  <CategoryIcon name={c.icon} className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.name}</span>
                  {c.description && <span className="block truncate text-sm text-ink-3">{c.description}</span>}
                </span>
                <ArrowRight className="size-4 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8">
          <EmptyState title="No categories are open for listings">
            An admin can add one in <Link href="/admin" className="text-brand hover:underline">Admin</Link>.
          </EmptyState>
        </div>
      )}
    </main>
  );
}
