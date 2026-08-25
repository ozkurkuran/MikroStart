import { describe, expect, it } from "vitest";

import { BUILT_IN_WORKSPACE_PACKS, parseWorkspacePack } from "./workspacePacks";

describe("workspacePacks", () => {
  it("keeps built-in packs data-only and schema-valid", () => {
    for (const pack of BUILT_IN_WORKSPACE_PACKS) {
      const parsed = parseWorkspacePack(JSON.stringify(pack));
      expect(parsed.layout.order.length).toBeGreaterThan(10);
      expect(JSON.stringify(parsed)).not.toMatch(/https?:|javascript:/i);
    }
  });

  it("rejects unsupported and oversized packs", () => {
    expect(() => parseWorkspacePack({ schema: "other", version: 1 })).toThrow("schema");
    expect(() => parseWorkspacePack("x".repeat(300_000))).toThrow("256 KB");
  });
});
