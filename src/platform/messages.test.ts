import { describe, expect, it } from "vitest";

import { isExtensionCommand } from "./messages";

describe("isExtensionCommand", () => {
  it("accepts versioned internal commands", () => {
    expect(isExtensionCommand({ type: "PING" })).toBe(true);
    expect(
      isExtensionCommand({
        type: "ADD_RSS_SOURCE",
        source: {
          id: "source-1",
          title: "Example feed",
          url: "https://example.org/feed.xml",
        },
      }),
    ).toBe(true);
    expect(
      isExtensionCommand({ type: "SCHEDULE_SOURCE_REFRESH", sourceId: "source-1" }),
    ).toBe(true);
    expect(
      isExtensionCommand({
        type: "SCHEDULE_COUNTDOWN_ALARM",
        countdownId: "anneal-1",
        targetAt: "2026-08-24T09:30:00.000Z",
      }),
    ).toBe(true);
    expect(isExtensionCommand({ type: "PLAY_ALARM_PREVIEW" })).toBe(true);
  });

  it("rejects unknown, incomplete, and oversized messages", () => {
    expect(isExtensionCommand(null)).toBe(false);
    expect(isExtensionCommand({ type: "FETCH_URL", url: "https://example.org" })).toBe(false);
    expect(
      isExtensionCommand({
        type: "ADD_RSS_SOURCE",
        source: { id: "source-1", title: "Missing URL" },
      }),
    ).toBe(false);
    expect(
      isExtensionCommand({ type: "REMOVE_SOURCE", sourceId: "x".repeat(129) }),
    ).toBe(false);
    expect(
      isExtensionCommand({
        type: "SCHEDULE_COUNTDOWN_ALARM",
        countdownId: "timer",
        targetAt: "not-a-date",
      }),
    ).toBe(false);
  });
});
