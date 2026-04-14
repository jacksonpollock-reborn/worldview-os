import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ComparisonView } from "@/components/comparison-view";
import { getAnalysisById } from "@/lib/data";

export const dynamic = "force-dynamic";

type CompareSearchParams = {
  a?: string | string[];
  b?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<CompareSearchParams>;
}) {
  const params = await searchParams;
  const idA = firstParam(params.a);
  const idB = firstParam(params.b);

  if (!idA || !idB) {
    return (
      <AppShell
        active="history"
        eyebrow="Compare"
        title="Select two analyses to compare"
        description="Comparison needs two saved analyses. Return to the history page and pick two records."
      >
        <EmptyState
          message="Missing analysis IDs. Use the Compare button on the history page with exactly two analyses selected."
        />
      </AppShell>
    );
  }

  if (idA === idB) {
    return (
      <AppShell
        active="history"
        eyebrow="Compare"
        title="Pick two different analyses"
        description="A comparison needs two distinct saved analyses."
      >
        <EmptyState message="Both selected analyses are the same record. Return to history and pick two different ones." />
      </AppShell>
    );
  }

  const [recordA, recordB] = await Promise.all([
    getAnalysisById(idA),
    getAnalysisById(idB),
  ]);

  if (!recordA || !recordB) {
    return (
      <AppShell
        active="history"
        eyebrow="Compare"
        title="Analysis not found"
        description="One or both analyses were not found."
      >
        <EmptyState
          message={
            !recordA && !recordB
              ? "Neither analysis could be loaded. They may have been deleted."
              : !recordA
                ? "The first analysis could not be loaded."
                : "The second analysis could not be loaded."
          }
        />
      </AppShell>
    );
  }

  // Order by createdAt so the "earlier" side is always on the left
  const orderedA =
    new Date(recordA.createdAt).getTime() <= new Date(recordB.createdAt).getTime()
      ? recordA
      : recordB;
  const orderedB = orderedA === recordA ? recordB : recordA;

  return (
    <AppShell
      active="history"
      eyebrow="Memory"
      title="Compare analyses"
      description="Side-by-side comparison of two saved analyses. The earlier analysis is on the left, the later one is on the right."
      compactHeader
    >
      <ComparisonView recordA={orderedA} recordB={orderedB} />
    </AppShell>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-4 flex gap-3">
        <Link
          href="/history"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Go to History
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-border bg-surface-muted px-4 py-2 text-sm font-medium text-foreground"
        >
          Ask a Question
        </Link>
      </div>
    </div>
  );
}
