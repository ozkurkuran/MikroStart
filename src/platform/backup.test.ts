import { describe, expect, it } from "vitest";

import { parseFullBackup, type BenchTabBackupEnvelope } from "./backup";

const valid: BenchTabBackupEnvelope = {
  format: "benchtab-full-backup", schemaVersion: 1,
  exportedAt: "2026-08-25T10:00:00.000Z", appVersion: "0.13.0",
  data: {
    chromeLocal: { "preferences.v1": { version: 1 } }, chromeSync: {},
    localStorage: { "benchtab.workflows.v1": "{}" },
    notebook: {
      format: "benchtab-notebook-export", schemaVersion: 1,
      exportedAt: "2026-08-25T10:00:00.000Z",
      data: { notes: [], references: [], calculations: [], sourceLinks: [] },
    },
  },
};

describe("full backup validation", () => {
  it("reconstructs an allowlisted full-backup envelope", () => {
    expect(parseFullBackup(JSON.stringify(valid))).toEqual(valid);
  });

  it("rejects unknown fields, unsafe keys, and oversized input", () => {
    expect(() => parseFullBackup({ ...valid, executable: "alert(1)" })).toThrow("unknown fields");
    expect(() => parseFullBackup({ ...valid, data: { ...valid.data, chromeLocal: { constructor: {} } } })).toThrow("unsafe key");
    expect(() => parseFullBackup("x".repeat(21 * 1024 * 1024))).toThrow("20 MiB");
  });
});
