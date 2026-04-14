import { AppShell } from "@/components/app-shell";
import { HistoryList } from "@/components/history-list";
import { getAllAnalysisSummaries } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const analyses = await getAllAnalysisSummaries();

  return (
    <AppShell
      active="history"
      eyebrow="Saved Forecasts"
      title="Analysis memory"
      description="Reopen prior runs, compare framing over time, and clear analyses you no longer need."
    >
      <HistoryList analyses={analyses} />
    </AppShell>
  );
}
