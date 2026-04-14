"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
          <div className="w-full rounded-3xl border border-border bg-surface p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Load Error
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              The app hit a server-side failure.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              {error.message || "Something went wrong while loading this page."}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white"
            >
              Try Again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
