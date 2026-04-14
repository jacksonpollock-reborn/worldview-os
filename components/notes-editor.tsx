"use client";

import { startTransition, useState } from "react";

type NotesEditorProps = {
  analysisId: string;
  initialNotes: string | null;
};

export function NotesEditor({ analysisId, initialNotes }: NotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [status, setStatus] = useState("");

  function handleSave() {
    setStatus("Saving...");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/history/${analysisId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        });

        if (!response.ok) {
          throw new Error("Unable to save notes.");
        }

        setStatus("Saved");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Save failed.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Add optional notes, follow-up ideas, or user overrides."
        className="min-h-40 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/10"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          These notes are local to the saved record and do not trigger re-analysis.
        </p>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm font-medium transition hover:bg-white"
        >
          Save Notes
        </button>
      </div>
      {status ? <p className="text-sm text-muted">{status}</p> : null}
    </div>
  );
}
