import type { AnalysisFollowUp as PrismaAnalysisFollowUp, Analysis as PrismaAnalysis } from "@prisma/client";
import { ZodError } from "zod";
import { generateStructuredJson } from "@/lib/llm";
import { getAnalysisRuntimeMode } from "@/lib/runtime-mode";
import { logServerError } from "@/lib/server-logger";
import { FOLLOW_UP_PROMPT_VERSION } from "@/lib/version-lineage";
import { AnalysisFollowUpOutputSchema } from "@/schemas/follow-up";
import type {
  AnalysisFollowUpOutput,
  AnalysisFollowUpRecord,
  AppSettingsValues,
  PersistedAnalysisRecord,
} from "@/types/analysis";
const MAX_CONTEXTUAL_FOLLOW_UPS = 3;

function parseStoredJson<T>(label: string, value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Stored ${label} data is invalid JSON.`);
  }
}

function buildFollowUpPrompts(
  analysisRecord: PersistedAnalysisRecord,
  question: string,
) {
  const recentFollowUps = analysisRecord.followUps.slice(-MAX_CONTEXTUAL_FOLLOW_UPS).map(
    (followUp) => ({
      question: followUp.question,
      title: followUp.title,
      answer: followUp.answer,
      key_points: followUp.keyPoints,
      watchouts: followUp.watchouts,
    }),
  );

  return {
    systemPrompt: [
      "You are Worldview OS follow-up mode.",
      "You answer targeted follow-up questions against a saved structured analysis.",
      "Do not regenerate the whole analysis and do not turn this into a chatbot exchange.",
      "Use the saved analysis context only. Do not imply current or live data you do not have.",
      "If the user asks for current or fresh information, say the saved analysis context does not provide it and answer only from the saved record.",
      "Return JSON only.",
    ].join(" "),
    userPrompt: [
      "Saved analysis context:",
      JSON.stringify(analysisRecord.analysis),
      "",
      analysisRecord.notes
        ? `Saved notes:\n${analysisRecord.notes}`
        : "Saved notes:\nNone",
      "",
      recentFollowUps.length > 0
        ? `Recent follow-ups:\n${JSON.stringify(recentFollowUps)}`
        : "Recent follow-ups:\nNone",
      "",
      `Targeted follow-up question:\n${question}`,
      "",
      "Instructions:",
      "- Answer only the targeted follow-up question.",
      "- Use the saved analysis as the source of truth unless you explicitly note a live-data limitation.",
      "- If the user references a numbered lens or scenario, infer the intended item from the saved ordering when possible.",
      "- Be concise, direct, and readable.",
      "- Prefer a scoped answer rather than a full re-analysis.",
      "- If the user asks for a checklist or challenge, reshape the saved analysis rather than recreating it from scratch.",
      "",
      "Return a single JSON object with this exact structure:",
      "{",
      '  "title": "short scoped heading",',
      '  "answer": "concise scoped answer using the saved analysis context",',
      '  "key_points": ["string"],',
      '  "watchouts": ["string"]',
      "}",
      "",
      "Rules:",
      "- title should be short and specific to the follow-up.",
      "- answer should usually be 1 to 3 short paragraphs.",
      "- key_points should contain 2 to 5 concrete takeaways.",
      "- watchouts should contain 0 to 4 risks, caveats, or signals worth tracking.",
      "- Do not restate every section of the original analysis.",
      "- Do not claim fresh current data unless it is explicitly present in the saved analysis context.",
    ].join("\n"),
  };
}

function extractJson(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const withoutFences = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "");

  if (withoutFences.startsWith("{")) {
    return withoutFences;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function parseOrdinalReference(question: string) {
  const match = question.match(/\b(?:lens|scenario)\s+(\d+)\b/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function buildMockFollowUpResult(
  analysisRecord: PersistedAnalysisRecord,
  question: string,
): AnalysisFollowUpOutput {
  const normalizedQuestion = question.toLowerCase();
  const ordinalReference = parseOrdinalReference(question);
  const referencedLens =
    ordinalReference && normalizedQuestion.includes("lens")
      ? analysisRecord.analysis.lenses[ordinalReference - 1]
      : null;
  const referencedScenario =
    ordinalReference && normalizedQuestion.includes("scenario")
      ? analysisRecord.analysis.scenarios[ordinalReference - 1]
      : null;

  if (referencedLens) {
    return {
      title: `${referencedLens.name}: follow-up focus`,
      answer: `${referencedLens.name} matters because ${referencedLens.why_it_matters} The clearest trigger to watch is ${referencedLens.leading_indicators[0] || referencedLens.key_drivers[0]}, because it shifts this lens before the rest of the analysis catches up.`,
      key_points: [
        `Primary mechanism: ${referencedLens.key_drivers[0] || referencedLens.name}.`,
        `Best early signal: ${referencedLens.leading_indicators[0] || referencedLens.evidence_for[0]}.`,
        `Most direct disconfirmation: ${referencedLens.disconfirming_signals[0] || referencedLens.evidence_against[0]}.`,
      ],
      watchouts: referencedLens.disconfirming_signals.slice(0, 2),
    };
  }

  if (referencedScenario) {
    return {
      title: `${referencedScenario.name}: probability shift`,
      answer: `${referencedScenario.name} becomes more likely if its leading indicators start clustering rather than appearing in isolation. The saved analysis points to ${referencedScenario.leading_indicators.slice(0, 2).join(" and ")} as the cleanest signals that this path is moving from background risk into the active base case.`,
      key_points: [
        `Trigger cluster: ${referencedScenario.leading_indicators[0] || referencedScenario.name}.`,
        `Impact profile: ${referencedScenario.impact} impact with ${referencedScenario.confidence} confidence in the saved analysis.`,
        `Time horizon: ${referencedScenario.time_horizon}.`,
      ],
      watchouts: analysisRecord.analysis.change_my_mind_conditions.slice(0, 2),
    };
  }

  if (normalizedQuestion.includes("monitor")) {
    return {
      title: "Monitor-mode checklist",
      answer: "Using the saved analysis as context, the most useful monitor view is a short operating checklist that tracks the current base case, the break signals, and the cadence for review. This does not refresh live data; it only reshapes the existing analysis into a tighter monitoring surface.",
      key_points: analysisRecord.analysis.watchlist.slice(0, 4),
      watchouts: analysisRecord.analysis.change_my_mind_conditions.slice(0, 2),
    };
  }

  if (normalizedQuestion.includes("bottom line") || normalizedQuestion.includes("challenge")) {
    return {
      title: "Bottom-line challenge",
      answer: `The main thing to challenge in the saved bottom line is the assumption that ${analysisRecord.analysis.bottom_line} The strongest attack is to focus on the fastest observable disconfirmation signal, not to reopen the entire analysis.`,
      key_points: [
        `Weakest assumption: ${analysisRecord.analysis.change_my_mind_conditions[0] || analysisRecord.analysis.hidden_variables[0]}.`,
        `Fastest falsifier: ${analysisRecord.analysis.watchlist[0] || analysisRecord.analysis.key_drivers[0]}.`,
        `Most likely blind spot: ${analysisRecord.analysis.hidden_variables[0] || analysisRecord.analysis.domains[0]}.`,
      ],
      watchouts: analysisRecord.analysis.change_my_mind_conditions.slice(0, 3),
    };
  }

  return {
    title: "Scoped follow-up",
    answer: "This follow-up uses the saved analysis context only. The most useful next move is to keep the original structure intact and deepen the specific mechanism, trigger, or scenario the question is pointing at rather than regenerating the whole worldview pass.",
    key_points: [
      `Base context: ${analysisRecord.analysis.reframed_question}`,
      `Best next drill-down: ${analysisRecord.analysis.key_drivers[0] || analysisRecord.analysis.domains[0]}.`,
      `Most useful signal to track: ${analysisRecord.analysis.watchlist[0] || analysisRecord.analysis.change_my_mind_conditions[0]}.`,
    ],
    watchouts: analysisRecord.analysis.hidden_variables.slice(0, 2),
  };
}

function validateFollowUpOutput(candidate: unknown) {
  try {
    return AnalysisFollowUpOutputSchema.parse(candidate);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `Follow-up output failed validation: ${error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    throw error;
  }
}

export async function runAnalysisFollowUp(
  analysisRecord: PersistedAnalysisRecord,
  question: string,
  settings: AppSettingsValues,
) {
  const runtimeMode = getAnalysisRuntimeMode();

  if (runtimeMode.mockModeActive) {
    return {
      followUp: buildMockFollowUpResult(analysisRecord, question),
      rawText: JSON.stringify({ mock: true, question }, null, 2),
      promptVersion: FOLLOW_UP_PROMPT_VERSION,
      modelUsed: "mock:follow-up",
    };
  }

  const { systemPrompt, userPrompt } = buildFollowUpPrompts(analysisRecord, question);
  const response = await generateStructuredJson({
    model: settings.model,
    systemPrompt,
    userPrompt,
    temperature: Math.min(settings.temperature, 0.25),
    maxTokens: Math.min(Math.max(1_200, Math.floor(settings.maxTokens * 0.45)), 2_400),
  });

  let parsedCandidate: unknown;

  try {
    parsedCandidate = JSON.parse(extractJson(response.text)) as unknown;
  } catch (error) {
    logServerError("follow_up.invalid_json", error, {
      analysisId: analysisRecord.id,
      question,
      rawText: response.text,
    });
    throw new Error("The model returned an invalid follow-up response.");
  }

  return {
    followUp: validateFollowUpOutput(parsedCandidate),
    rawText: response.text,
    promptVersion: FOLLOW_UP_PROMPT_VERSION,
    modelUsed: settings.model,
  };
}

export function buildAnalysisFollowUpRecordInput(input: {
  analysisId: string;
  question: string;
  followUp: AnalysisFollowUpOutput;
  rawText: string;
  modelUsed: string;
  promptVersion: string;
}) {
  return {
    analysisId: input.analysisId,
    question: input.question,
    title: input.followUp.title,
    answer: input.followUp.answer,
    keyPointsJson: JSON.stringify(input.followUp.key_points),
    watchoutsJson: JSON.stringify(input.followUp.watchouts),
    rawResponseJson: input.rawText,
    modelUsed: input.modelUsed,
    promptVersion: input.promptVersion,
  };
}

export function parseAnalysisFollowUpRecord(
  record: PrismaAnalysisFollowUp,
): AnalysisFollowUpRecord {
  return {
    id: record.id,
    question: record.question,
    title: record.title,
    answer: record.answer,
    keyPoints: parseStoredJson<string[]>("follow-up key points", record.keyPointsJson),
    watchouts: parseStoredJson<string[]>("follow-up watchouts", record.watchoutsJson),
    modelUsed: record.modelUsed,
    promptVersion: record.promptVersion,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type AnalysisWithFollowUpsRecord = PrismaAnalysis & {
  followUps: PrismaAnalysisFollowUp[];
};
