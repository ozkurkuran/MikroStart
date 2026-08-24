import { describe, expect, it, vi } from "vitest";

import type { ChromeAiScope } from "./chrome-api";
import {
  ChromeBuiltInAiProvider,
  UnavailableAiProvider,
  createDefaultAiProvider,
} from "./providers";
import { AiUnavailableError } from "./types";

describe("AI provider fallback", () => {
  it("selects the unavailable provider when Chrome exposes no built-in API", () => {
    expect(createDefaultAiProvider({})).toBeInstanceOf(UnavailableAiProvider);
  });

  it("reports unsupported capabilities without downloading anything", async () => {
    const provider = new UnavailableAiProvider();
    const report = await provider.getCapabilities();
    expect(report.localOnly).toBe(true);
    expect(report.cloudFallback).toBe(false);
    expect(
      Object.values(report.capabilities).every(
        ({ availability, ready }) => availability === "unsupported" && !ready,
      ),
    ).toBe(true);
  });

  it("fails operations explicitly instead of using a cloud fallback", async () => {
    const provider = new UnavailableAiProvider();
    await expect(provider.translate({} as never)).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
  });

  it("feature-detects partial Chrome implementations", async () => {
    const availability = vi.fn(async () => "available" as const);
    const create = vi.fn();
    const scope: ChromeAiScope = {
      Summarizer: { availability, create },
    };
    const provider = createDefaultAiProvider(scope);
    expect(provider).toBeInstanceOf(ChromeBuiltInAiProvider);
    const report = await provider.getCapabilities();
    expect(report.capabilities.summarization.availability).toBe("available");
    expect(report.capabilities.translation.availability).toBe("unsupported");
    expect(availability).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("turns availability probe errors into an unavailable status", async () => {
    const scope: ChromeAiScope = {
      LanguageModel: {
        availability: vi.fn(async () => {
          throw new Error("internal detail");
        }),
        create: vi.fn(),
      },
    };
    const report = await new ChromeBuiltInAiProvider(scope).getCapabilities();
    expect(report.capabilities["language-model"].availability).toBe("unavailable");
    expect(report.capabilities["language-model"].detail).not.toContain(
      "internal detail",
    );
  });
});
