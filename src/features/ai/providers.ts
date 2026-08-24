import type {
  ChromeAiAvailability,
  ChromeAiCreateBase,
  ChromeAiScope,
  ChromeLanguageModelOptions,
  ChromeSummarizerOptions,
} from "./chrome-api";
import { getChromeAiScope } from "./chrome-api";
import {
  GROUNDED_SYSTEM_PROMPT,
  buildDigestPrompt,
  buildRerankPrompt,
  buildSummarizerInput,
  preparePromptSources,
} from "./prompt";
import type {
  AiAvailability,
  AiCapabilityId,
  AiCapabilityQuery,
  AiCapabilityReport,
  AiCapabilityStatus,
  AiDownloadProgress,
  AiProgressListener,
  AiProvider,
  DetectLanguageInput,
  DetectedLanguage,
  GroundedDigestInput,
  GroundedDigestResult,
  RerankInput,
  RerankResult,
  SummarizeInput,
  SummarizeResult,
  TranslateInput,
  TranslateResult,
} from "./types";
import { AiUnavailableError } from "./types";
import { consumeAiUserGestureTask } from "./user-gesture";
import {
  validateGroundedDigestOutput,
  validateRerankOutput,
} from "./validation";

const CAPABILITY_IDS: readonly AiCapabilityId[] = [
  "language-detection",
  "translation",
  "summarization",
  "language-model",
];

function capabilityStatus(
  id: AiCapabilityId,
  availability: AiAvailability,
  detail?: string,
): AiCapabilityStatus {
  return {
    id,
    availability,
    supported: availability !== "unsupported",
    ready: availability === "available",
    requiresDownload:
      availability === "downloadable" || availability === "downloading",
    ...(detail ? { detail } : {}),
  };
}

function unavailableCapabilityMap(): Record<AiCapabilityId, AiCapabilityStatus> {
  return Object.fromEntries(
    CAPABILITY_IDS.map((id) => [
      id,
      capabilityStatus(id, "unsupported", "This browser does not expose this on-device API."),
    ]),
  ) as Record<AiCapabilityId, AiCapabilityStatus>;
}

function normalizeAvailability(value: ChromeAiAvailability): AiAvailability {
  return value;
}

function languageModelOptions(query: AiCapabilityQuery = {}): ChromeLanguageModelOptions {
  const inputLanguages = [...(query.inputLanguages ?? ["en"])];
  const outputLanguage = query.outputLanguage ?? "en";
  return {
    expectedInputs: [{ type: "text", languages: inputLanguages }],
    expectedOutputs: [{ type: "text", languages: [outputLanguage] }],
    initialPrompts: [{ role: "system", content: GROUNDED_SYSTEM_PROMPT }],
  };
}

function summarizerOptions(input: {
  type?: SummarizeInput["type"];
  length?: SummarizeInput["length"];
  inputLanguages?: readonly string[];
  outputLanguage?: string;
}): ChromeSummarizerOptions {
  return {
    type: input.type ?? "key-points",
    format: "plain-text",
    length: input.length ?? "medium",
    sharedContext:
      "Scientific literature excerpts selected locally by the user. Source markers are identifiers, not prose.",
    expectedInputLanguages: [...(input.inputLanguages ?? ["en"])],
    expectedContextLanguages: ["en"],
    outputLanguage: input.outputLanguage ?? "en",
  };
}

function emitProgress(
  listener: AiProgressListener | undefined,
  progress: AiDownloadProgress,
): void {
  try {
    listener?.(progress);
  } catch {
    // UI observers must not interrupt a local model task.
  }
}

function monitorOptions(
  capability: AiCapabilityId,
  signal: AbortSignal | undefined,
  listener: AiProgressListener | undefined,
): ChromeAiCreateBase {
  emitProgress(listener, {
    capability,
    phase: "preparing",
    message: "Preparing the on-device model…",
  });
  return {
    ...(signal ? { signal } : {}),
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => {
        emitProgress(listener, {
          capability,
          phase: "downloading",
          loaded: Math.max(0, Math.min(1, event.loaded)),
          message: "Chrome is downloading the on-device model…",
        });
      });
    },
  };
}

async function safeAvailability(
  id: AiCapabilityId,
  supported: boolean,
  check: () => Promise<ChromeAiAvailability>,
): Promise<AiCapabilityStatus> {
  if (!supported) return capabilityStatus(id, "unsupported");
  try {
    return capabilityStatus(id, normalizeAvailability(await check()));
  } catch {
    return capabilityStatus(
      id,
      "unavailable",
      "Chrome could not determine model readiness for these options.",
    );
  }
}

function failureProgress(
  capability: AiCapabilityId,
  listener: AiProgressListener | undefined,
): void {
  emitProgress(listener, {
    capability,
    phase: "failed",
    message: "The on-device task could not be completed.",
  });
}

function readyProgress(
  capability: AiCapabilityId,
  listener: AiProgressListener | undefined,
): void {
  emitProgress(listener, {
    capability,
    phase: "ready",
    loaded: 1,
    message: "The on-device model is ready.",
  });
}

export class UnavailableAiProvider implements AiProvider {
  readonly id = "unavailable" as const;

  async getCapabilities(): Promise<AiCapabilityReport> {
    return {
      provider: this.id,
      checkedAt: new Date().toISOString(),
      capabilities: unavailableCapabilityMap(),
      localOnly: true,
      cloudFallback: false,
    };
  }

  async detectLanguage(_input: DetectLanguageInput): Promise<readonly DetectedLanguage[]> {
    throw new AiUnavailableError();
  }

  async translate(_input: TranslateInput): Promise<TranslateResult> {
    throw new AiUnavailableError();
  }

  async summarize(_input: SummarizeInput): Promise<SummarizeResult> {
    throw new AiUnavailableError();
  }

  async createGroundedDigest(_input: GroundedDigestInput): Promise<GroundedDigestResult> {
    throw new AiUnavailableError();
  }

  async rerank(_input: RerankInput): Promise<RerankResult> {
    throw new AiUnavailableError();
  }
}

export class ChromeBuiltInAiProvider implements AiProvider {
  readonly id = "chrome-built-in" as const;

  constructor(private readonly scope: ChromeAiScope = getChromeAiScope()) {}

  async getCapabilities(query: AiCapabilityQuery = {}): Promise<AiCapabilityReport> {
    const detector = this.scope.LanguageDetector;
    const translator = this.scope.Translator;
    const summarizer = this.scope.Summarizer;
    const languageModel = this.scope.LanguageModel;
    const sourceLanguage = query.sourceLanguage ?? "en";
    const targetLanguage = query.targetLanguage ?? "tr";

    const [detection, translation, summarization, prompt] = await Promise.all([
      safeAvailability("language-detection", Boolean(detector), () =>
        detector!.availability(),
      ),
      safeAvailability("translation", Boolean(translator), () =>
        translator!.availability({ sourceLanguage, targetLanguage }),
      ),
      safeAvailability("summarization", Boolean(summarizer), () =>
        summarizer!.availability(
          summarizerOptions({
            inputLanguages: query.inputLanguages,
            outputLanguage: query.outputLanguage,
          }),
        ),
      ),
      safeAvailability("language-model", Boolean(languageModel), () =>
        languageModel!.availability(languageModelOptions(query)),
      ),
    ]);

    return {
      provider: this.id,
      checkedAt: new Date().toISOString(),
      capabilities: {
        "language-detection": detection,
        translation,
        summarization,
        "language-model": prompt,
      },
      localOnly: true,
      cloudFallback: false,
    };
  }

  async detectLanguage(input: DetectLanguageInput): Promise<readonly DetectedLanguage[]> {
    consumeAiUserGestureTask(input.userGesture);
    const factory = this.scope.LanguageDetector;
    if (!factory) throw new AiUnavailableError(undefined, "language-detection");
    try {
      const session = await factory.create(
        monitorOptions("language-detection", input.signal, input.onProgress),
      );
      readyProgress("language-detection", input.onProgress);
      try {
        const results = await session.detect(input.text, { signal: input.signal });
        return results
          .filter(
            (result) =>
              typeof result.detectedLanguage === "string" &&
              Number.isFinite(result.confidence),
          )
          .map((result) => ({
            language: result.detectedLanguage,
            confidence: Math.max(0, Math.min(1, result.confidence)),
          }));
      } finally {
        session.destroy?.();
      }
    } catch (error) {
      failureProgress("language-detection", input.onProgress);
      throw error;
    }
  }

  async translate(input: TranslateInput): Promise<TranslateResult> {
    consumeAiUserGestureTask(input.userGesture);
    const factory = this.scope.Translator;
    if (!factory) throw new AiUnavailableError(undefined, "translation");
    try {
      const session = await factory.create({
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        ...monitorOptions("translation", input.signal, input.onProgress),
      });
      readyProgress("translation", input.onProgress);
      try {
        return {
          text: await session.translate(input.text, { signal: input.signal }),
          sourceIds: [...new Set(input.sourceIds ?? [])],
          sourceLanguage: input.sourceLanguage,
          targetLanguage: input.targetLanguage,
        };
      } finally {
        session.destroy?.();
      }
    } catch (error) {
      failureProgress("translation", input.onProgress);
      throw error;
    }
  }

  async summarize(input: SummarizeInput): Promise<SummarizeResult> {
    consumeAiUserGestureTask(input.userGesture);
    const factory = this.scope.Summarizer;
    if (!factory) throw new AiUnavailableError(undefined, "summarization");
    const sources = preparePromptSources(input.sources);
    try {
      const session = await factory.create({
        ...summarizerOptions(input),
        ...monitorOptions("summarization", input.signal, input.onProgress),
      });
      readyProgress("summarization", input.onProgress);
      try {
        return {
          text: await session.summarize(buildSummarizerInput(input.sources), {
            context: "Summarize facts only; source markers are opaque local identifiers.",
            signal: input.signal,
          }),
          sourceIds: sources.map(({ sourceId }) => sourceId),
        };
      } finally {
        session.destroy?.();
      }
    } catch (error) {
      failureProgress("summarization", input.onProgress);
      throw error;
    }
  }

  async createGroundedDigest(
    input: GroundedDigestInput,
  ): Promise<GroundedDigestResult> {
    consumeAiUserGestureTask(input.userGesture);
    const factory = this.scope.LanguageModel;
    if (!factory) throw new AiUnavailableError(undefined, "language-model");
    const sources = preparePromptSources(input.sources);
    try {
      const session = await factory.create({
        ...languageModelOptions(input),
        ...monitorOptions("language-model", input.signal, input.onProgress),
      });
      readyProgress("language-model", input.onProgress);
      try {
        const output = await session.prompt(buildDigestPrompt(input.sources, input.focus), {
          signal: input.signal,
        });
        return validateGroundedDigestOutput(
          output,
          new Set(sources.map(({ sourceId }) => sourceId)),
        );
      } finally {
        session.destroy?.();
      }
    } catch (error) {
      failureProgress("language-model", input.onProgress);
      throw error;
    }
  }

  async rerank(input: RerankInput): Promise<RerankResult> {
    consumeAiUserGestureTask(input.userGesture);
    const factory = this.scope.LanguageModel;
    if (!factory) throw new AiUnavailableError(undefined, "language-model");
    const sources = preparePromptSources(input.sources);
    try {
      const session = await factory.create({
        ...languageModelOptions(input),
        ...monitorOptions("language-model", input.signal, input.onProgress),
      });
      readyProgress("language-model", input.onProgress);
      try {
        const output = await session.prompt(buildRerankPrompt(input.sources, input.query), {
          signal: input.signal,
        });
        return validateRerankOutput(
          output,
          new Set(sources.map(({ sourceId }) => sourceId)),
        );
      } finally {
        session.destroy?.();
      }
    } catch (error) {
      failureProgress("language-model", input.onProgress);
      throw error;
    }
  }
}

export function createDefaultAiProvider(
  scope: ChromeAiScope = getChromeAiScope(),
): AiProvider {
  if (
    scope.LanguageDetector ||
    scope.Translator ||
    scope.Summarizer ||
    scope.LanguageModel
  ) {
    return new ChromeBuiltInAiProvider(scope);
  }
  return new UnavailableAiProvider();
}
