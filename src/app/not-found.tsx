import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-medium text-brand">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">This page isn&apos;t here</h1>
      <p className="mt-2 text-ink-2">The listing may have been removed, or the link is wrong.</p>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-white">
        Browse listings
      </Link>
    </main>
  );
}
