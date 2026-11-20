import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronRight, MapPin, ShieldCheck, Tag } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ListingCard } from "@/components/ListingCard";
import { Gallery } from "@/components/Gallery";
import { PublishedBanner } from "@/components/PublishedBanner";
import { Card } from "@/components/ui";
import { CONDITIONS, conditionLabel, formatPrice, timeAgo } from "@/lib/listing";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { getListing, similarListings } from "@/server/services/listings";

export const dynamic = "force-dynamic";

async function load(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const db = await getDb();
  try {
    return { db, listing: await getListing(db, id) };
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { listing } = await load((await params).id);
  return { title: listing.title, description: listing.description.slice(0, 150) };
}

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ published?: string }> }) {
  const { db, listing } = await load((await params).id);
  const justPublished = (await searchParams).published === "1";
  const similar = await similarListings(db, listing.id, listing.category.id);
  const condition = CONDITIONS.find((c) => c.value === listing.condition);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      {justPublished && <PublishedBanner listingId={listing.id} />}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 py-5 text-sm text-ink-3">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link href={`/?category=${listing.category.slug}`} className="hover:text-ink">
          {listing.category.name}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate text-ink-2">{listing.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          <Gallery images={listing.images} alt={listing.title} fallbackIcon={listing.category.icon} />

          {listing.specs.length > 0 && (
            <section aria-labelledby="specs">
              <h2 id="specs" className="mb-3 text-lg font-semibold tracking-tight">
                {listing.category.name.replace(/s$/, "")} details
              </h2>
              <Card className="overflow-hidden">
                <dl className="grid sm:grid-cols-2">
                  {listing.specs.map((s) => (
                    <div key={s.key} className="flex justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0 sm:odd:border-r">
                      <dt className="text-sm text-ink-3">{s.label}</dt>
                      <dd className="text-right text-sm font-medium">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </section>
          )}

          <section aria-labelledby="desc">
            <h2 id="desc" className="mb-3 text-lg font-semibold tracking-tight">
              Description
            </h2>
            <p className="whitespace-pre-line leading-relaxed text-ink-2">{listing.description}</p>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <div className="mb-2 flex items-center gap-1.5 text-sm text-ink-3">
              <CategoryIcon name={listing.category.icon} className="size-4" />
              {listing.category.name}
            </div>
            <h1 className="text-xl font-semibold leading-snug tracking-tight">{listing.title}</h1>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{formatPrice(listing.price)}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-2">
              <li className="flex items-center gap-2">
                <Tag className="size-4 text-ink-3" />
                <span>
                  <span className="font-medium text-ink">{conditionLabel(listing.condition)}</span>
                  {condition && <span className="text-ink-3"> · {condition.hint}</span>}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-ink-3" />
                {listing.location}
              </li>
              <li className="flex items-center gap-2">
                <CalendarClock className="size-4 text-ink-3" />
                Listed {timeAgo(listing.createdAt)}
              </li>
            </ul>
            <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-ink">{listing.sellerName.charAt(0).toUpperCase()}</div>
              <div>
                <p className="text-sm font-medium">{listing.sellerName}</p>
                <p className="text-xs text-ink-3">Seller</p>
              </div>
            </div>
          </Card>
          <div className="flex gap-3 rounded-[var(--radius-card)] bg-brand-soft/60 p-4 text-sm text-brand-ink">
            <ShieldCheck className="size-5 shrink-0" />
            <p>Meet in a public place, check the item before paying, and never pay in advance.</p>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">More in {listing.category.name}</h2>
            <Link href={`/?category=${listing.category.slug}`} className="text-sm text-brand hover:underline">
              See all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {similar.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
