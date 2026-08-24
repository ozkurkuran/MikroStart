export interface TimestampedQuickNoteOptions {
  label?: string;
}

export function createTimestampedQuickNote(
  text: string,
  now: Date | number | string = Date.now(),
  options: TimestampedQuickNoteOptions = {},
): string {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 2_000) {
    throw new RangeError("Quick note must contain 1–2,000 characters.");
  }
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) throw new RangeError("A valid note date is required.");
  const label = options.label?.trim();
  const prefix = label ? `[${date.toISOString()}] ${label}:` : `[${date.toISOString()}]`;
  return `${prefix} ${trimmed}`;
}
