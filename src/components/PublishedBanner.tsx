"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, X } from "lucide-react";

/** Confirmation after publishing. Cleans `?published=1` so a refresh doesn't repeat it. */
export function PublishedBanner({ listingId }: { listingId: number }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    window.history.replaceState(null, "", `/listings/${listingId}`);
  }, [listingId]);
  if (!open) return null;
  return (
    <div role="status" className="animate-reveal mt-5 flex items-center gap-3 rounded-[var(--radius-card)] border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-brand-ink">
      <CircleCheck className="size-5 shrink-0" />
      <p className="flex-1">
        <span className="font-medium">Your listing is live.</span> This is what buyers see.{" "}
        <Link href="/sell" className="underline underline-offset-2">
          Sell another item
        </Link>
      </p>
      <button type="button" onClick={() => setOpen(false)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-brand/10">
        <X className="size-4" />
      </button>
    </div>
  );
}
