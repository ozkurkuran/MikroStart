/*
 * Structural declarations for Chrome's built-in AI globals. Keeping them local
 * avoids making the rest of the app depend on experimental DOM typings.
 */

export type ChromeAiAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface ChromeAiDownloadEvent extends Event {
  readonly loaded: number;
}

export interface ChromeAiMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: ChromeAiDownloadEvent) => void,
  ): void;
}

export interface ChromeAiCreateBase {
  signal?: AbortSignal;
  monitor?: (monitor: ChromeAiMonitor) => void;
}

export interface ChromeLanguageDetection {
  detectedLanguage: string;
  confidence: number;
}

export interface ChromeLanguageDetectorSession {
  detect(text: string, options?: { signal?: AbortSignal }): Promise<ChromeLanguageDetection[]>;
  destroy?(): void;
}

export interface ChromeLanguageDetectorFactory {
  availability(): Promise<ChromeAiAvailability>;
  create(options?: ChromeAiCreateBase): Promise<ChromeLanguageDetectorSession>;
}

export interface ChromeTranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export interface ChromeTranslatorSession {
  translate(text: string, options?: { signal?: AbortSignal }): Promise<string>;
  destroy?(): void;
}

export interface ChromeTranslatorFactory {
  availability(options: ChromeTranslatorOptions): Promise<ChromeAiAvailability>;
  create(options: ChromeTranslatorOptions & ChromeAiCreateBase): Promise<ChromeTranslatorSession>;
}

export interface ChromeSummarizerOptions {
  sharedContext?: string;
  type?: "key-points" | "tldr" | "teaser" | "headline";
  format?: "markdown" | "plain-text";
  length?: "short" | "medium" | "long";
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
}

export interface ChromeSummarizerSession {
  summarize(
    text: string,
    options?: { context?: string; signal?: AbortSignal },
  ): Promise<string>;
  destroy?(): void;
}

export interface ChromeSummarizerFactory {
  availability(options?: ChromeSummarizerOptions): Promise<ChromeAiAvailability>;
  create(
    options?: ChromeSummarizerOptions & ChromeAiCreateBase,
  ): Promise<ChromeSummarizerSession>;
}

export interface ChromeLanguageModelPrompt {
  role: "system" | "user" | "assistant";
  content: string;
  prefix?: boolean;
}

export interface ChromeLanguageModelOptions {
  expectedInputs?: Array<{ type: "text"; languages?: string[] }>;
  expectedOutputs?: Array<{ type: "text"; languages?: string[] }>;
  initialPrompts?: ChromeLanguageModelPrompt[];
}

export interface ChromeLanguageModelSession {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  destroy?(): void;
}

export interface ChromeLanguageModelFactory {
  availability(options?: ChromeLanguageModelOptions): Promise<ChromeAiAvailability>;
  create(
    options?: ChromeLanguageModelOptions & ChromeAiCreateBase,
  ): Promise<ChromeLanguageModelSession>;
}

export interface ChromeAiScope {
  LanguageDetector?: ChromeLanguageDetectorFactory;
  Translator?: ChromeTranslatorFactory;
  Summarizer?: ChromeSummarizerFactory;
  LanguageModel?: ChromeLanguageModelFactory;
}

export function getChromeAiScope(): ChromeAiScope {
  return globalThis as unknown as ChromeAiScope;
}
