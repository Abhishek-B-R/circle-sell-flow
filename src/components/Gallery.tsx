"use client";

import { useState } from "react";
import { cn } from "./ui";
import { CategoryIcon } from "./CategoryIcon";

/* eslint-disable @next/next/no-img-element -- sellers paste images from any host */
export function Gallery({ images, alt, fallbackIcon }: { images: string[]; alt: string; fallbackIcon: string }) {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const shown = images.map((src, i) => ({ src, i })).filter(({ i }) => !broken.has(i));
  const current = shown.find((s) => s.i === index) ?? shown[0];

  if (!current) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-[var(--radius-card)] border border-line bg-surface text-ink-3">
        <div className="text-center">
          <CategoryIcon name={fallbackIcon} className="mx-auto size-14" />
          <p className="mt-2 text-sm">No photos added</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <img
          src={current.src}
          alt={alt}
          className="size-full object-cover"
          onError={() => setBroken((b) => new Set(b).add(current.i))}
        />
      </div>
      {shown.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {shown.map(({ src, i }) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={current.i === i}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-lg border-2 transition sm:size-20",
                current.i === i ? "border-ink" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img src={src} alt="" className="size-full object-cover" onError={() => setBroken((b) => new Set(b).add(i))} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
