import { describe, expect, it } from "vitest";

import { evaluateWatchCondition, extractJsonWatchValue, isWatchDue, normalizeJsonWatch } from "./watchStore";

const base = { id: "watch-1", title: "Latest release", url: "https://example.org/releases.json", path: "releases.0.version", intervalMinutes: 60 as const, condition: "changed" as const, conditionValue: "", notify: false, enabled: true, addedAt: "2026-08-20T10:00:00Z" };

describe("watchStore", () => {
  it("normalizes HTTPS monitors and extracts dotted or pointer paths", () => {
    expect(normalizeJsonWatch(base).url).toBe("https://example.org/releases.json");
    const data = { releases: [{ version: "2.0" }] };
    expect(extractJsonWatchValue(data, "releases.0.version")).toBe("2.0");
    expect(extractJsonWatchValue(data, "/releases/0/version")).toBe("2.0");
  });

  it("rejects insecure URLs and prototype path keys", () => {
    expect(() => normalizeJsonWatch({ ...base, url: "http://example.org/a" })).toThrow("HTTPS");
    expect(() => normalizeJsonWatch({ ...base, path: "__proto__.polluted" })).toThrow("forbidden");
  });

  it("evaluates text and numeric conditions deterministically", () => {
    expect(evaluateWatchCondition("contains", "ready", "System READY", false)).toBe(true);
    expect(evaluateWatchCondition("number-above", "10", "10.5", true)).toBe(true);
    expect(evaluateWatchCondition("changed", "", "anything", false)).toBe(false);
  });

  it("respects the configured refresh interval", () => {
    const watch = normalizeJsonWatch({ ...base, lastCheckedAt: "2026-08-20T10:00:00Z" });
    expect(isWatchDue(watch, Date.parse("2026-08-20T10:59:59Z"))).toBe(false);
    expect(isWatchDue(watch, Date.parse("2026-08-20T11:00:00Z"))).toBe(true);
  });
});
