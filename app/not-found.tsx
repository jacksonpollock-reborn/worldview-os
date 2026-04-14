import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell
      active="analysis"
      eyebrow="Not Found"
      title="Analysis record not found"
      description="The requested analysis may have been deleted or the link is incomplete."
    >
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm text-muted">
          Return to the ask screen or review the saved history list.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Go Home
          </Link>
          <Link
            href="/history"
            className="rounded-xl border border-border bg-surface-muted px-4 py-2 text-sm font-medium"
          >
            Open History
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
