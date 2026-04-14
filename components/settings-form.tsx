"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppSettingsValues } from "@/types/analysis";

type SettingsFormProps = {
  settings: AppSettingsValues;
  apiKeyConfigured: boolean;
  mockModeActive: boolean;
  forceMockMode: boolean;
  providerName: string;
};

export function SettingsForm({
  settings,
  apiKeyConfigured,
  mockModeActive,
  forceMockMode,
  providerName,
}: SettingsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [status, setStatus] = useState("");
  const [isPending, setIsPending] = useState(false);

  function updateField<Key extends keyof AppSettingsValues>(
    key: Key,
    value: AppSettingsValues[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsPending(true);

    startTransition(async () => {
      try {
        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Unable to save settings.");
        }

        setStatus("Settings saved.");
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to save settings.");
      } finally {
        setIsPending(false);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="model">
                Model
              </label>
              <input
                id="model"
                value={form.model}
                onChange={(event) => updateField("model", event.target.value)}
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="schemaMode">
                Schema mode
              </label>
              <select
                id="schemaMode"
                value={form.schemaMode}
                onChange={(event) =>
                  updateField("schemaMode", event.target.value as AppSettingsValues["schemaMode"])
                }
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
              >
                <option value="strict-json">Strict JSON</option>
                <option value="strict-json-repair">Strict JSON + repair</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="temperature">
                Temperature
              </label>
              <input
                id="temperature"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={form.temperature}
                onChange={(event) =>
                  updateField("temperature", Number(event.target.value || 0))
                }
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="maxTokens">
                Max output tokens
              </label>
              <input
                id="maxTokens"
                type="number"
                min="500"
                step="100"
                value={form.maxTokens}
                onChange={(event) =>
                  updateField("maxTokens", Number(event.target.value || 0))
                }
                className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="systemPromptOverride">
              System prompt override
            </label>
            <textarea
              id="systemPromptOverride"
              value={form.systemPromptOverride ?? ""}
              onChange={(event) =>
                updateField("systemPromptOverride", event.target.value || null)
              }
              placeholder="Leave blank to use prompts/system.txt"
              className="min-h-56 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Keep the prompt narrow. The product is a structured analysis engine, not a chatbot.
            </p>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
          {status ? <p className="text-sm text-muted">{status}</p> : null}
        </div>

        <aside className="space-y-4 rounded-2xl border border-border bg-surface-muted p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Environment status</h2>
            <p className="mt-1 text-sm text-muted">
              These controls stay local to the MVP. There is no multi-user configuration layer yet.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Runtime
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {mockModeActive ? "Mock analysis active" : `Live ${providerName} analysis`}
            </p>
            <p className="mt-1 text-sm text-muted">
              {mockModeActive
                ? forceMockMode
                  ? "Mock mode is being forced by the environment variable MOCK_ANALYSIS_MODE=true."
                  : "No API key is configured, so the app will fall back to a realistic structured sample response."
                : `A live ${providerName} key is configured and analysis requests will use the selected model.`}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Provider API key
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {apiKeyConfigured ? "Configured" : "Missing"}
            </p>
            <p className="mt-1 text-sm text-muted">
              To test with a live model, set <code className="rounded bg-surface-muted px-1 py-0.5">LLM_API_KEY</code> or a provider-specific key such as <code className="rounded bg-surface-muted px-1 py-0.5">KIMI_API_KEY</code>, then leave mock mode disabled.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Prompt source
            </p>
            <p className="mt-2 text-sm text-muted">
              Default behavior comes from <code className="rounded bg-surface-muted px-1 py-0.5">prompts/system.txt</code>{" "}
              and <code className="rounded bg-surface-muted px-1 py-0.5">prompts/worldview-analysis.txt</code>.
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
