import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { getAppSettings } from "@/lib/data";
import { getAnalysisRuntimeMode } from "@/lib/runtime-mode";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getAppSettings();
  const runtimeMode = getAnalysisRuntimeMode();

  return (
    <AppShell
      active="settings"
      eyebrow="Framework Controls"
      title="Analysis settings"
      description="Keep the controls sparse: model, prompt override, response strictness, and token budget."
    >
      <SettingsForm
        settings={settings}
        apiKeyConfigured={runtimeMode.apiKeyConfigured}
        mockModeActive={runtimeMode.mockModeActive}
        forceMockMode={runtimeMode.forceMockMode}
        providerName={runtimeMode.providerName}
      />
    </AppShell>
  );
}
