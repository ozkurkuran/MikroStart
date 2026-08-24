export type ExtensionCommand =
  | { type: "PING" }
  | { type: "OPEN_DASHBOARD" }
  | {
      type: "ADD_RSS_SOURCE";
      source: { id: string; title: string; url: string };
    }
  | { type: "SCHEDULE_SOURCE_REFRESH"; sourceId: string }
  | { type: "REMOVE_SOURCE"; sourceId: string }
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
