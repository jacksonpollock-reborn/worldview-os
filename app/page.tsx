import { AppShell } from "@/components/app-shell";
import { QuestionForm } from "@/components/question-form";
import { RecentAnalyses } from "@/components/recent-analyses";
import { getRecentAnalyses } from "@/lib/data";
import { DEMO_QUESTIONS } from "@/lib/demo-content";
import { getAnalysisRuntimeMode } from "@/lib/runtime-mode";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const recentAnalyses = await getRecentAnalyses(6);
  const runtimeMode = getAnalysisRuntimeMode();

  return (
    <AppShell
      active="ask"
      eyebrow="Structured Intelligence"
      title="Ask one question. Get the full analytical surface."
      description="Worldview OS reframes the question, expands it across serious lenses, and returns scenarios, hidden variables, and watchpoints in a fixed structure."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <QuestionForm
          demoQuestions={DEMO_QUESTIONS}
          mockModeActive={runtimeMode.mockModeActive}
          apiKeyConfigured={runtimeMode.apiKeyConfigured}
          providerName={runtimeMode.providerName}
        />
        <RecentAnalyses analyses={recentAnalyses} />
      </div>
    </AppShell>
  );
}
