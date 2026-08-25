import type { LiteratureStreamConfig } from "../features/feeds";
import type { JsonWatchConfig } from "./watchStore";

export type ExtensionCommand =
  | { type: "PING" }
  | { type: "OPEN_DASHBOARD" }
  | {
      type: "ADD_RSS_SOURCE";
      source: { id: string; title: string; url: string };
    }
  | { type: "SCHEDULE_SOURCE_REFRESH"; sourceId: string }
  | { type: "REMOVE_SOURCE"; sourceId: string }
  | { type: "SAVE_LITERATURE_STREAM"; stream: LiteratureStreamConfig }
  | { type: "RUN_LITERATURE_STREAM"; streamId: string }
  | { type: "REMOVE_LITERATURE_STREAM"; streamId: string }
  | { type: "SAVE_JSON_WATCH"; watch: JsonWatchConfig }
  | { type: "RUN_JSON_WATCH"; watchId: string }
  | { type: "REMOVE_JSON_WATCH"; watchId: string }
  | {
      type: "SCHEDULE_COUNTDOWN_ALARM";
      countdownId: string;
      targetAt: string;
    }
  | { type: "CANCEL_COUNTDOWN_ALARM"; countdownId: string }
  | { type: "CANCEL_ALL_COUNTDOWN_ALARMS" }
  | { type: "PLAY_ALARM_PREVIEW" };

export type ExtensionResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

export function isExtensionCommand(value: unknown): value is ExtensionCommand {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.type === "PING" ||
    candidate.type === "OPEN_DASHBOARD" ||
    candidate.type === "CANCEL_ALL_COUNTDOWN_ALARMS" ||
    candidate.type === "PLAY_ALARM_PREVIEW"
  ) {
    return true;
  }

  if (
    (candidate.type === "RUN_LITERATURE_STREAM" ||
      candidate.type === "REMOVE_LITERATURE_STREAM") &&
    typeof candidate.streamId === "string"
  ) {
    return candidate.streamId.length > 0 && candidate.streamId.length <= 128;
  }

  if (
    (candidate.type === "RUN_JSON_WATCH" || candidate.type === "REMOVE_JSON_WATCH") &&
    typeof candidate.watchId === "string"
  ) return candidate.watchId.length > 0 && candidate.watchId.length <= 128;

  if (candidate.type === "SAVE_JSON_WATCH") {
    const watch = candidate.watch;
    if (typeof watch !== "object" || watch === null) return false;
    const record = watch as Record<string, unknown>;
    return (
      typeof record.id === "string" && record.id.length > 0 && record.id.length <= 128 &&
      typeof record.title === "string" && record.title.length > 0 && record.title.length <= 100 &&
      typeof record.url === "string" && record.url.length > 0 && record.url.length <= 2_048 &&
      typeof record.path === "string" && record.path.length <= 240 &&
      (record.intervalMinutes === 30 || record.intervalMinutes === 60 || record.intervalMinutes === 180 || record.intervalMinutes === 360 || record.intervalMinutes === 720 || record.intervalMinutes === 1440) &&
      (record.condition === "changed" || record.condition === "contains" || record.condition === "not-contains" || record.condition === "number-above" || record.condition === "number-below") &&
      typeof record.conditionValue === "string" && record.conditionValue.length <= 240 &&
      typeof record.notify === "boolean"
    );
  }

  if (candidate.type === "SAVE_LITERATURE_STREAM") {
    const stream = candidate.stream;
    if (typeof stream !== "object" || stream === null) return false;
    const record = stream as Record<string, unknown>;
    return (
      typeof record.id === "string" && record.id.length > 0 && record.id.length <= 128 &&
      typeof record.title === "string" && record.title.length > 0 && record.title.length <= 100 &&
      typeof record.query === "string" && record.query.length >= 2 && record.query.length <= 240 &&
      Array.isArray(record.providers) && record.providers.length >= 1 && record.providers.length <= 2 &&
      record.providers.every((provider) => provider === "arxiv" || provider === "crossref") &&
      Array.isArray(record.blockedTerms) && record.blockedTerms.length <= 20 &&
      record.blockedTerms.every((term) => typeof term === "string" && term.length <= 80) &&
      (record.sort === "newest" || record.sort === "relevance") &&
      (record.pageSize === 10 || record.pageSize === 20 || record.pageSize === 30 || record.pageSize === 50)
    );
  }

  if (
    candidate.type === "CANCEL_COUNTDOWN_ALARM" &&
    typeof candidate.countdownId === "string"
  ) {
    return candidate.countdownId.length > 0 && candidate.countdownId.length <= 160;
  }

  if (
    candidate.type === "SCHEDULE_COUNTDOWN_ALARM" &&
    typeof candidate.countdownId === "string" &&
    typeof candidate.targetAt === "string"
  ) {
    return (
      candidate.countdownId.length > 0 &&
      candidate.countdownId.length <= 160 &&
      Number.isFinite(Date.parse(candidate.targetAt))
    );
  }

  if (
    (candidate.type === "SCHEDULE_SOURCE_REFRESH" ||
      candidate.type === "REMOVE_SOURCE") &&
    typeof candidate.sourceId === "string"
  ) {
    return candidate.sourceId.length > 0 && candidate.sourceId.length <= 128;
  }

  if (candidate.type === "ADD_RSS_SOURCE") {
    const source = candidate.source;
    if (typeof source !== "object" || source === null) return false;
    const record = source as Record<string, unknown>;
    return (
      typeof record.id === "string" &&
      record.id.length > 0 &&
      record.id.length <= 128 &&
      typeof record.title === "string" &&
      record.title.length > 0 &&
      record.title.length <= 160 &&
      typeof record.url === "string" &&
      record.url.length > 0 &&
      record.url.length <= 2_048
    );
  }

  return false;
}
