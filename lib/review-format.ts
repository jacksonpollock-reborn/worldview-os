import { NO_CLEAR_SCENARIO_MATCH } from "@/schemas/review";
import type {
  OutcomeLabel,
  TriggerState,
  WatchlistTriggerState,
} from "@/types/analysis";

export function formatOutcomeLabel(
  value: OutcomeLabel | null | undefined,
): string | null {
  if (!value) return null;
  if (value === "mostly_right") return "Mostly right";
  if (value === "mixed") return "Mixed";
  if (value === "wrong") return "Wrong";
  return null;
}

export function formatRealizedScenario(value: string | null): string {
  if (!value) return "—";
  if (value === NO_CLEAR_SCENARIO_MATCH) return "No clear scenario match";
  return value;
}

export function formatTrigger(value: TriggerState | null): string {
  if (!value) return "—";
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return "Unknown";
}

export function formatWatchlistTrigger(
  value: WatchlistTriggerState | null,
): string {
  if (!value) return "—";
  if (value === "yes") return "Yes";
  if (value === "partially") return "Partially";
  if (value === "no") return "No";
  return "Unknown";
}
