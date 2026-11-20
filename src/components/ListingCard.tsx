import Link from "next/link";
import { MapPin } from "lucide-react";
import { conditionLabel, formatPrice, timeAgo } from "@/lib/listing";
import type { ListingCard as Card } from "@/server/services/listings";
import { CategoryIcon } from "./CategoryIcon";

export function ListingCard({ listing }: { listing: Card }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-canvas">
        {listing.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- sellers paste any image host
          <img src={listing.image} alt="" loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-3">
            <CategoryIcon name={listing.category.icon} className="size-10" />
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-surface/90 px-2 py-0.5 text-xs font-medium text-ink-2 backdrop-blur">
          {conditionLabel(listing.condition)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <p className="text-lg font-semibold tracking-tight tabular-nums">{formatPrice(listing.price)}</p>
        <h3 className="line-clamp-2 text-[15px] leading-snug text-ink">{listing.title}</h3>
        {listing.highlights.length > 0 && <p className="truncate text-[13px] text-ink-2">{listing.highlights.join(" · ")}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-ink-3">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{listing.location}</span>
          </span>
          <span className="shrink-0">{timeAgo(listing.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
