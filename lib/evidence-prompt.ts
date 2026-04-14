import { getSourceRegistration } from "@/lib/sources/source-registry";
import type { EvidenceItem } from "@/lib/sources/types";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "timestamp unavailable";
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return timestamp.toISOString();
}

function buildEvidenceLine(item: EvidenceItem) {
  const registration = getSourceRegistration(item.source_id);
  const sourceName = registration?.source_name || item.source_id;
  const evidenceType = item.evidence_type === "observed" ? "observed" : item.evidence_type;
  const freshness = item.freshness;
  const dataTimestamp = formatTimestamp(item.data_timestamp);
  const retrievedAt = formatTimestamp(item.retrieved_at);

  return `- ${item.claim} (source: ${sourceName}; type: ${evidenceType}; freshness: ${freshness}; data timestamp: ${dataTimestamp}; retrieved: ${retrievedAt})`;
}

export function buildEvidencePromptBlock(evidence: EvidenceItem[] | null | undefined) {
  if (!evidence || evidence.length === 0) {
    return "";
  }

  return [
    "Evidence block:",
    "The following normalized evidence was retrieved for this analysis request.",
    "Use only these source-backed observations for current-state factual claims.",
    "",
    ...evidence.map(buildEvidenceLine),
    "",
    "Evidence usage rules:",
    "- Treat this block as the full set of source-backed current observations available for this analysis.",
    "- Do not fabricate, update, interpolate, or imply any current value that is not explicitly present in this block.",
    "- Distinguish observed source-backed facts from reasoning or inference derived from them.",
    "- If an item is labeled live or recent, cite the source and timestamp when using it.",
    "- If an item is labeled stale, describe it only as the last available reading and do not present it as current.",
    "- If a source is unavailable, say so plainly and fall back to structural reasoning only.",
    "- Outside these sourced observations, avoid freshness-sensitive wording such as recent, ongoing, latest, today, now, or currently.",
    '- If you need to discuss a present-tense mechanism without source support, label it as "structural reasoning only" rather than as an observed current fact.',
    '- Do not use words like "currently", "right now", "latest", or "live" unless directly supported by an observed item in this block.',
    "- If the block does not support a claim, answer from structural reasoning and label that limitation clearly.",
  ].join("\n");
}
