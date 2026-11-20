import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-full border-[3px] border-brand" aria-hidden />
          <span className="text-lg">circle</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/admin" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-ink-2 hover:bg-ink/5 hover:text-ink">
            <Settings2 className="size-4" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
          <Link href="/sell" className="flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-medium text-white hover:bg-brand-ink">
            <Plus className="size-4" strokeWidth={2.5} />
            Sell
          </Link>
        </nav>
      </div>
    </header>
  );
}
