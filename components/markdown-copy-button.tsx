"use client";

import { useState } from "react";

type MarkdownCopyButtonProps = {
  markdown: string;
};

export function MarkdownCopyButton({ markdown }: MarkdownCopyButtonProps) {
  const [status, setStatus] = useState("Copy Markdown");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setStatus("Copied");
      window.setTimeout(() => setStatus("Copy Markdown"), 1600);
    } catch {
      setStatus("Copy failed");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-xl border border-border bg-surface-muted px-4 py-2 text-sm font-medium transition hover:bg-white"
    >
      {status}
    </button>
  );
}
