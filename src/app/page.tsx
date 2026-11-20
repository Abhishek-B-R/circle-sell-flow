import Link from "next/link";
import { PackageOpen, Search } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ListingCard } from "@/components/ListingCard";
import { cn, EmptyState } from "@/components/ui";
import { getDb } from "@/server/db";
import { listCategories } from "@/server/services/categories";
import { listListings } from "@/server/services/listings";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const { category, q } = await searchParams;
  const db = await getDb();
  const [categories, listings] = await Promise.all([listCategories(db), listListings(db, { category, q })]);
  const active = categories.find((c) => c.slug === category);

  const chip = (href: string, selected: boolean, children: React.ReactNode) => (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
        selected ? "border-ink bg-ink text-white" : "border-line-2 bg-surface text-ink-2 hover:border-ink-3",
      )}
    >
      {children}
    </Link>
  );
  const withQuery = (slug?: string) => {
    const p = new URLSearchParams();
    if (slug) p.set("category", slug);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <section className="flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pre-owned, fairly priced.</h1>
          <p className="mt-2 text-ink-2">Phones, laptops and furniture from people near you. Selling takes about two minutes.</p>
        </div>
        <form action="/" className="relative w-full sm:w-80">
          {category && <input type="hidden" name="category" value={category} />}
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search listings"
            aria-label="Search listings"
            className="h-11 w-full rounded-full border border-line-2 bg-surface pl-10 pr-4 text-[15px] placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </form>
      </section>

      <nav aria-label="Categories" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {chip(withQuery(), !category, "All")}
        {categories.map((c) =>
          chip(
            withQuery(c.slug),
            c.slug === category,
            <>
              <CategoryIcon name={c.icon} className="size-4" />
              {c.name}
              <span className="text-xs opacity-60">{c.listingCount}</span>
            </>,
          ),
        )}
      </nav>

      {(q || active) && (
        <p className="mb-4 text-sm text-ink-2">
          {listings.length} result{listings.length === 1 ? "" : "s"}
          {q && <> for &ldquo;{q}&rdquo;</>}
          {active && <> in {active.name}</>}
          {" · "}
          <Link href="/" className="text-brand underline-offset-2 hover:underline">
            Clear
          </Link>
        </p>
      )}

      {listings.length ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<PackageOpen className="size-8" />} title={q || active ? "Nothing matches yet" : "No listings yet"}>
          <p>
            Have something to sell?{" "}
            <Link href={active ? `/sell/${active.slug}` : "/sell"} className="text-brand underline-offset-2 hover:underline">
              Create the first listing
            </Link>
            .
          </p>
        </EmptyState>
      )}
    </main>
  );
}
