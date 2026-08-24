export { AiResearchPanel, type AiPanelResult, type AiResearchPanelProps } from "./AiResearchPanel";
export { getChromeAiScope, type ChromeAiScope } from "./chrome-api";
export {
  ChromeBuiltInAiProvider,
  UnavailableAiProvider,
  createDefaultAiProvider,
} from "./providers";
export {
  buildDigestPrompt,
  buildRerankPrompt,
  buildSummarizerInput,
  createOpaqueAiSourceId,
  isOpaqueAiSourceId,
  preparePromptSources,
} from "./prompt";
export {
  AiOutputValidationError,
  AiUnavailableError,
  AiUserGestureRequiredError,
} from "./types";
export type {
  AiAvailability,
  AiCapabilityId,
  AiCapabilityQuery,
  AiCapabilityReport,
  AiCapabilityStatus,
  AiDownloadProgress,
  AiProgressListener,
  AiProvider,
  AiResearchSource,
  AiTaskOptions,
  AiUserGestureTask,
  DetectLanguageInput,
  DetectedLanguage,
  GroundedDigestInput,
  GroundedDigestItem,
  GroundedDigestResult,
  OpaqueAiSourceId,
  RerankInput,
  RerankItem,
  RerankResult,
  SummarizeInput,
  SummarizeResult,
  TranslateInput,
  TranslateResult,
} from "./types";
export { createAiUserGestureTask } from "./user-gesture";
export { validateGroundedDigestOutput, validateRerankOutput } from "./validation";
