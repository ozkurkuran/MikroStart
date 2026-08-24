export type AiCapabilityId =
  | "language-detection"
  | "translation"
  | "summarization"
  | "language-model";

export type AiAvailability =
  | "unsupported"
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface AiCapabilityStatus {
  id: AiCapabilityId;
  availability: AiAvailability;
  supported: boolean;
  ready: boolean;
  requiresDownload: boolean;
  /** A safe, user-facing explanation. It never contains browser internals. */
  detail?: string;
}

export interface AiCapabilityReport {
  provider: "chrome-built-in" | "unavailable";
  checkedAt: string;
  capabilities: Readonly<Record<AiCapabilityId, AiCapabilityStatus>>;
  localOnly: true;
  cloudFallback: false;
}

export type AiProgressPhase =
  | "preparing"
  | "downloading"
  | "ready"
  | "failed";

export interface AiDownloadProgress {
  capability: AiCapabilityId;
  phase: AiProgressPhase;
  /** A normalized value from 0 through 1 when Chrome reports it. */
  loaded?: number;
  message: string;
}

export type AiProgressListener = (progress: AiDownloadProgress) => void;

declare const userGestureTaskBrand: unique symbol;

/**
 * An opaque, single-use token created while Chrome reports active user
 * activation. ChromeBuiltInAiProvider consumes it before creating a session.
 */
export interface AiUserGestureTask {
  readonly [userGestureTaskBrand]: true;
}

export interface AiTaskOptions {
  userGesture: AiUserGestureTask;
  signal?: AbortSignal;
  onProgress?: AiProgressListener;
}

declare const opaqueAiSourceIdBrand: unique symbol;

/** A model-facing alias that contains no URL, DOI, or connector identity. */
export type OpaqueAiSourceId = string & {
  readonly [opaqueAiSourceIdBrand]: true;
};

export interface AiResearchSource {
  /** Opaque local identifier. It must not be a URL or DOI. */
  sourceId: OpaqueAiSourceId;
  title: string;
  text: string;
  language?: string;
}

export interface DetectLanguageInput extends AiTaskOptions {
  text: string;
}

export interface DetectedLanguage {
  language: string;
  confidence: number;
}

export interface TranslateInput extends AiTaskOptions {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceIds?: readonly OpaqueAiSourceId[];
}

export interface TranslateResult {
  text: string;
  sourceIds: readonly OpaqueAiSourceId[];
  sourceLanguage: string;
  targetLanguage: string;
}

export type SummarizerType = "key-points" | "tldr" | "teaser" | "headline";
export type SummarizerLength = "short" | "medium" | "long";

export interface SummarizeInput extends AiTaskOptions {
  sources: readonly AiResearchSource[];
  type?: SummarizerType;
  length?: SummarizerLength;
  inputLanguages?: readonly string[];
  outputLanguage?: string;
}

export interface SummarizeResult {
  text: string;
  /** Citations are attached from the input; the model cannot create them. */
  sourceIds: readonly OpaqueAiSourceId[];
}

export interface GroundedDigestInput extends AiTaskOptions {
  sources: readonly AiResearchSource[];
  focus?: string;
  inputLanguages?: readonly string[];
  outputLanguage?: string;
}

export interface GroundedDigestItem {
  text: string;
  sourceIds: readonly OpaqueAiSourceId[];
}

export interface GroundedDigestResult {
  items: readonly GroundedDigestItem[];
}

export interface RerankInput extends AiTaskOptions {
  sources: readonly AiResearchSource[];
  query: string;
  inputLanguages?: readonly string[];
  outputLanguage?: string;
}

export interface RerankItem {
  sourceId: OpaqueAiSourceId;
  /** Relevance from 0 through 1. */
  score: number;
  reason: string;
}

export interface RerankResult {
  items: readonly RerankItem[];
}

export interface AiCapabilityQuery {
  sourceLanguage?: string;
  targetLanguage?: string;
  inputLanguages?: readonly string[];
  outputLanguage?: string;
}

export interface AiProvider {
  readonly id: "chrome-built-in" | "unavailable";
  getCapabilities(query?: AiCapabilityQuery): Promise<AiCapabilityReport>;
  detectLanguage(input: DetectLanguageInput): Promise<readonly DetectedLanguage[]>;
  translate(input: TranslateInput): Promise<TranslateResult>;
  summarize(input: SummarizeInput): Promise<SummarizeResult>;
  createGroundedDigest(input: GroundedDigestInput): Promise<GroundedDigestResult>;
  rerank(input: RerankInput): Promise<RerankResult>;
}

export class AiUnavailableError extends Error {
  readonly name = "AiUnavailableError";

  constructor(
    message = "On-device AI is not available in this Chrome installation.",
    readonly capability?: AiCapabilityId,
  ) {
    super(message);
  }
}

export class AiUserGestureRequiredError extends Error {
  readonly name = "AiUserGestureRequiredError";

  constructor() {
    super("Start on-device AI directly from a click or keyboard action.");
  }
}

export class AiOutputValidationError extends Error {
  readonly name = "AiOutputValidationError";

  constructor(
    message: string,
    readonly issues: readonly string[],
  ) {
    super(message);
  }
}
