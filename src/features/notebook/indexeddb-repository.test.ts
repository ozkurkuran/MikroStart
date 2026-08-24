import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { IndexedDbNotebookRepository } from "./indexeddb-repository";
import { MemoryNotebookRepository } from "./memory-repository";

const DATABASE_NAME = "benchtab-notebook-import-test";

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

beforeEach(async () => {
  await deleteDatabase(DATABASE_NAME);
});

describe("IndexedDbNotebookRepository import", () => {
  it("restores a validated export transactionally", async () => {
    const source = new MemoryNotebookRepository();
    await source.createNote({
      id: "imported-note",
      type: "experiment",
      title: "Imported experiment",
      markdown: "Pressure: 1e-6 mbar",
    });
    const envelope = await source.exportData("0.2.0");
    const target = new IndexedDbNotebookRepository({ databaseName: DATABASE_NAME });

    const result = await target.importData(JSON.stringify(envelope));
    expect(result.notes).toBe(1);
    expect(await target.getNote("imported-note")).toMatchObject({
      title: "Imported experiment",
      markdown: "Pressure: 1e-6 mbar",
    });
    target.close();
  });
});
