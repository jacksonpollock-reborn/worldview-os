"use client";

import { startTransition, useState } from "react";

type TitleEditorProps = {
  analysisId: string;
  initialTitle: string;
};

export function TitleEditor({ analysisId, initialTitle }: TitleEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState("");

  function handleSave() {
    setStatus("Saving...");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/history/${analysisId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });

        if (!response.ok) {
          throw new Error("Unable to save title.");
        }

        setStatus("Saved");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Save failed.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-2xl font-semibold tracking-tight outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
        />
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm font-medium transition hover:bg-white"
        >
          Save Title
        </button>
      </div>
      {status ? <p className="text-sm text-muted">{status}</p> : null}
    </div>
  );
}
