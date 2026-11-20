"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-ink-2">Please try again in a moment.</p>
      <button onClick={reset} className="mt-6 inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-white">
        Try again
      </button>
    </main>
  );
}
