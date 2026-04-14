import { parseBottomLineSegments } from "@/lib/bottom-line";
import type {
  MonitorStructuredAnalysis,
  PersistedAnalysisRecord,
  StandardStructuredAnalysis,
  StructuredAnalysis,
} from "@/types/analysis";

export type StringArrayDiff = {
  onlyInA: string[];
  onlyInB: string[];
  shared: string[];
};

export type BottomLineLabelDiff = {
  label: string;
  valueA: string;
  valueB: string;
  changed: boolean;
};

export type ScenarioDiffEntry = {
  name: string;
  a: StandardStructuredAnalysis["scenarios"][number];
  b: StandardStructuredAnalysis["scenarios"][number];
  probabilityDelta: number;
  descriptionChanged: boolean;
};

export type ScenarioDiff = {
  matched: ScenarioDiffEntry[];
  onlyInA: StandardStructuredAnalysis["scenarios"];
  onlyInB: StandardStructuredAnalysis["scenarios"];
};

export type MonitoringSignalDiffEntry = {
  name: string;
  a: MonitorStructuredAnalysis["monitoring_signals"][number];
  b: MonitorStructuredAnalysis["monitoring_signals"][number];
  bullishChanged: boolean;
  neutralChanged: boolean;
  bearishChanged: boolean;
  currentReadChanged: boolean;
};

export type MonitoringSignalDiff = {
  matched: MonitoringSignalDiffEntry[];
  onlyInA: MonitorStructuredAnalysis["monitoring_signals"];
  onlyInB: MonitorStructuredAnalysis["monitoring_signals"];
};

export type DefinitionDiffEntry = {
  term: string;
  valueA: string | null;
  valueB: string | null;
  changed: boolean;
};

export type AnalysisComparability = {
  sameMode: boolean;
  sharedSections: string[];
  mismatchReasons: string[];
  bothStandard: boolean;
  bothMonitor: boolean;
};

export function isMonitorAnalysis(
  analysis: StructuredAnalysis,
): analysis is MonitorStructuredAnalysis {
  return (
    analysis.objective.trim().toLowerCase() === "monitor" &&
    "monitoring_signals" in analysis
  );
}

export function isStandardAnalysis(
  analysis: StructuredAnalysis,
): analysis is StandardStructuredAnalysis {
  return !isMonitorAnalysis(analysis);
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function diffStringArrays(a: string[], b: string[]): StringArrayDiff {
  const aNormalized = new Map<string, string>();
  const bNormalized = new Map<string, string>();

  for (const item of a) {
    const key = normalizeKey(item);
    if (key && !aNormalized.has(key)) {
      aNormalized.set(key, item);
    }
  }
  for (const item of b) {
    const key = normalizeKey(item);
    if (key && !bNormalized.has(key)) {
      bNormalized.set(key, item);
    }
  }

  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  const shared: string[] = [];

  for (const [key, value] of aNormalized) {
    if (bNormalized.has(key)) {
      shared.push(value);
    } else {
      onlyInA.push(value);
    }
  }
  for (const [key, value] of bNormalized) {
    if (!aNormalized.has(key)) {
      onlyInB.push(value);
    }
  }

  return { onlyInA, onlyInB, shared };
}

export function diffBottomLineLabels(
  a: string,
  b: string,
): BottomLineLabelDiff[] {
  const segmentsA = parseBottomLineSegments(a);
  const segmentsB = parseBottomLineSegments(b);

  if (segmentsA.length === 0 && segmentsB.length === 0) {
    return [
      {
        label: "Bottom line",
        valueA: a.trim(),
        valueB: b.trim(),
        changed: a.trim() !== b.trim(),
      },
    ];
  }

  const orderedLabels = [
    "View",
    "Reason",
    "Risk",
    "Downgrade if",
    "Upgrade if",
    "Review",
    "Ignore",
  ] as const;

  const mapA = new Map(segmentsA.map((seg) => [seg.label, seg.value]));
  const mapB = new Map(segmentsB.map((seg) => [seg.label, seg.value]));

  const seenLabels = new Set<string>();
  const result: BottomLineLabelDiff[] = [];

  for (const label of orderedLabels) {
    if (mapA.has(label) || mapB.has(label)) {
      const valueA = mapA.get(label) ?? "";
      const valueB = mapB.get(label) ?? "";
      result.push({
        label,
        valueA,
        valueB,
        changed: normalizeKey(valueA) !== normalizeKey(valueB),
      });
      seenLabels.add(label);
    }
  }

  // Any non-standard labels found
  for (const seg of segmentsA) {
    if (!seenLabels.has(seg.label)) {
      result.push({
        label: seg.label,
        valueA: seg.value,
        valueB: mapB.get(seg.label) ?? "",
        changed: normalizeKey(seg.value) !== normalizeKey(mapB.get(seg.label) ?? ""),
      });
      seenLabels.add(seg.label);
    }
  }
  for (const seg of segmentsB) {
    if (!seenLabels.has(seg.label)) {
      result.push({
        label: seg.label,
        valueA: mapA.get(seg.label) ?? "",
        valueB: seg.value,
        changed: normalizeKey(mapA.get(seg.label) ?? "") !== normalizeKey(seg.value),
      });
      seenLabels.add(seg.label);
    }
  }

  return result;
}

export function diffScenarios(
  a: StandardStructuredAnalysis["scenarios"],
  b: StandardStructuredAnalysis["scenarios"],
): ScenarioDiff {
  const mapA = new Map<string, StandardStructuredAnalysis["scenarios"][number]>();
  const mapB = new Map<string, StandardStructuredAnalysis["scenarios"][number]>();

  for (const scenario of a) {
    const key = normalizeKey(scenario.name);
    if (key && !mapA.has(key)) {
      mapA.set(key, scenario);
    }
  }
  for (const scenario of b) {
    const key = normalizeKey(scenario.name);
    if (key && !mapB.has(key)) {
      mapB.set(key, scenario);
    }
  }

  const matched: ScenarioDiffEntry[] = [];
  const onlyInA: StandardStructuredAnalysis["scenarios"] = [];
  const onlyInB: StandardStructuredAnalysis["scenarios"] = [];

  for (const [key, scenarioA] of mapA) {
    const scenarioB = mapB.get(key);
    if (scenarioB) {
      matched.push({
        name: scenarioA.name,
        a: scenarioA,
        b: scenarioB,
        probabilityDelta: scenarioB.probability - scenarioA.probability,
        descriptionChanged:
          normalizeKey(scenarioA.description) !== normalizeKey(scenarioB.description),
      });
    } else {
      onlyInA.push(scenarioA);
    }
  }
  for (const [key, scenarioB] of mapB) {
    if (!mapA.has(key)) {
      onlyInB.push(scenarioB);
    }
  }

  return { matched, onlyInA, onlyInB };
}

export function diffMonitoringSignals(
  a: MonitorStructuredAnalysis["monitoring_signals"],
  b: MonitorStructuredAnalysis["monitoring_signals"],
): MonitoringSignalDiff {
  const mapA = new Map<string, MonitorStructuredAnalysis["monitoring_signals"][number]>();
  const mapB = new Map<string, MonitorStructuredAnalysis["monitoring_signals"][number]>();

  for (const signal of a) {
    const key = normalizeKey(signal.name);
    if (key && !mapA.has(key)) {
      mapA.set(key, signal);
    }
  }
  for (const signal of b) {
    const key = normalizeKey(signal.name);
    if (key && !mapB.has(key)) {
      mapB.set(key, signal);
    }
  }

  const matched: MonitoringSignalDiffEntry[] = [];
  const onlyInA: MonitorStructuredAnalysis["monitoring_signals"] = [];
  const onlyInB: MonitorStructuredAnalysis["monitoring_signals"] = [];

  for (const [key, signalA] of mapA) {
    const signalB = mapB.get(key);
    if (signalB) {
      matched.push({
        name: signalA.name,
        a: signalA,
        b: signalB,
        bullishChanged:
          normalizeKey(signalA.bullish_threshold) !== normalizeKey(signalB.bullish_threshold),
        neutralChanged:
          normalizeKey(signalA.neutral_threshold) !== normalizeKey(signalB.neutral_threshold),
        bearishChanged:
          normalizeKey(signalA.bearish_threshold) !== normalizeKey(signalB.bearish_threshold),
        currentReadChanged:
          normalizeKey(signalA.current_read || "") !==
          normalizeKey(signalB.current_read || ""),
      });
    } else {
      onlyInA.push(signalA);
    }
  }
  for (const [key, signalB] of mapB) {
    if (!mapA.has(key)) {
      onlyInB.push(signalB);
    }
  }

  return { matched, onlyInA, onlyInB };
}

export function diffDefinitions(
  a: StructuredAnalysis["definitions"],
  b: StructuredAnalysis["definitions"],
): DefinitionDiffEntry[] {
  const mapA = new Map<string, string>();
  const mapB = new Map<string, string>();

  for (const def of a) {
    const key = normalizeKey(def.term);
    if (key) mapA.set(key, def.definition);
  }
  for (const def of b) {
    const key = normalizeKey(def.term);
    if (key) mapB.set(key, def.definition);
  }

  const allKeys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
  const result: DefinitionDiffEntry[] = [];

  for (const key of allKeys) {
    const valueA = mapA.get(key) ?? null;
    const valueB = mapB.get(key) ?? null;
    // Find the original term (non-normalized) from whichever source has it
    const originalTerm =
      a.find((d) => normalizeKey(d.term) === key)?.term ??
      b.find((d) => normalizeKey(d.term) === key)?.term ??
      key;

    result.push({
      term: originalTerm,
      valueA,
      valueB,
      changed:
        valueA !== valueB &&
        (valueA === null ||
          valueB === null ||
          normalizeKey(valueA) !== normalizeKey(valueB)),
    });
  }

  return result;
}

export function analysisComparability(
  a: StructuredAnalysis,
  b: StructuredAnalysis,
): AnalysisComparability {
  const aIsMonitor = isMonitorAnalysis(a);
  const bIsMonitor = isMonitorAnalysis(b);
  const bothStandard = !aIsMonitor && !bIsMonitor;
  const bothMonitor = aIsMonitor && bIsMonitor;
  const sameMode = bothStandard || bothMonitor;

  const sharedSections = [
    "original_question",
    "reframed_question",
    "definitions",
    "domains",
    "key_drivers",
    "hidden_variables",
    "change_my_mind_conditions",
    "bottom_line",
    "watchlist",
  ];

  const mismatchReasons: string[] = [];
  if (!sameMode) {
    mismatchReasons.push(
      "Comparing a standard analysis with a monitor analysis. Mode-specific sections (lenses/scenarios vs monitoring signals) are not directly comparable.",
    );
  }

  return { sameMode, sharedSections, mismatchReasons, bothStandard, bothMonitor };
}

export type PromptLineageComparison = {
  same: boolean;
  versionA: string;
  versionB: string;
  modelA: string | null;
  modelB: string | null;
};

export function comparePromptLineage(
  a: PersistedAnalysisRecord,
  b: PersistedAnalysisRecord,
): PromptLineageComparison {
  return {
    same: a.promptVersion === b.promptVersion && a.modelUsed === b.modelUsed,
    versionA: a.promptVersion,
    versionB: b.promptVersion,
    modelA: a.modelUsed,
    modelB: b.modelUsed,
  };
}
