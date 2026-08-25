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
    expect(isExtensionCommand({
      type: "SAVE_LITERATURE_STREAM",
      stream: {
        id: "thin-film",
        title: "Thin films",
        query: "thin film deposition",
        providers: ["arxiv", "crossref"],
        blockedTerms: ["conference"],
        sort: "newest",
        pageSize: 20,
      },
    })).toBe(true);
    expect(isExtensionCommand({ type: "RUN_LITERATURE_STREAM", streamId: "thin-film" })).toBe(true);
    expect(isExtensionCommand({
      type: "SAVE_JSON_WATCH",
      watch: {
        id: "watch-1",
        title: "Release",
        url: "https://example.org/releases.json",
        path: "latest.version",
        intervalMinutes: 60,
        condition: "changed",
        conditionValue: "",
        notify: false,
      },
    })).toBe(true);
    expect(isExtensionCommand({ type: "RUN_JSON_WATCH", watchId: "watch-1" })).toBe(true);
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
    expect(isExtensionCommand({
      type: "SAVE_LITERATURE_STREAM",
      stream: {
        id: "bad",
        title: "Bad",
        query: "x",
        providers: ["unknown"],
        blockedTerms: [],
        sort: "newest",
        pageSize: 999,
      },
    })).toBe(false);
    expect(isExtensionCommand({
      type: "SAVE_JSON_WATCH",
      watch: {
        id: "watch-1",
        title: "Release",
        url: "https://example.org/releases.json",
        path: "x".repeat(241),
        intervalMinutes: 60,
        condition: "changed",
        conditionValue: "",
        notify: false,
      },
    })).toBe(false);
  });
});
