import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { clearBackupSnapshots, listBackupSnapshots, saveBackupSnapshot } from "./backupSnapshots";
import type { BenchTabBackupEnvelope } from "./backup";

const envelope = (day: number): BenchTabBackupEnvelope => ({
  format: "benchtab-full-backup", schemaVersion: 1,
  exportedAt: `2026-08-${String(day).padStart(2, "0")}T10:00:00.000Z`,
  appVersion: "0.13.0", data: { chromeLocal: {}, chromeSync: {}, localStorage: {}, notebook: {
    format: "benchtab-notebook-export", schemaVersion: 1, exportedAt: "2026-08-20T10:00:00.000Z",
    data: { notes: [], references: [], calculations: [], sourceLinks: [] },
  } },
});

describe("backupSnapshots", () => {
  beforeEach(async () => { await clearBackupSnapshots(); });

  it("retains only the newest three recovery snapshots", async () => {
    for (const day of [20, 21, 22, 23]) await saveBackupSnapshot(envelope(day), "download");
    const snapshots = await listBackupSnapshots();
    expect(snapshots).toHaveLength(3);
    expect(snapshots.every((snapshot) => snapshot.sizeBytes > 0)).toBe(true);
  });
});
