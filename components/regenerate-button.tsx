"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function RegenerateButton({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState("");

  function handleRegenerate() {
    setStatus("");
    setIsPending(true);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/history/${analysisId}/regenerate`, {
          method: "POST",
        });
        const data = (await response.json()) as { id?: string; error?: string };

        if (!response.ok || !data.id) {
          throw new Error(data.error || "Unable to regenerate this analysis.");
        }

        router.push(`/analysis/${data.id}`);
        router.refresh();
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : "Unable to regenerate this analysis.",
        );
      } finally {
        setIsPending(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={isPending}
        className="rounded-xl border border-border bg-surface-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Regenerating..." : "Regenerate"}
      </button>
      {status ? <p className="text-sm text-muted">{status}</p> : null}
    </div>
  );
}
