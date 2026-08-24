import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  claimNextRefreshJob,
  completeRefreshJob,
  enqueueSourceRefresh,
  retryRefreshJob,
} from "./jobQueue";

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

beforeEach(async () => {
  await deleteDatabase("benchtab-jobs");
});

describe("durable refresh queue", () => {
  it("leases a queued job once and removes it only after completion", async () => {
    await enqueueSourceRefresh("source-a");

    const claimed = await claimNextRefreshJob();
    expect(claimed).toMatchObject({
      id: "refresh:source-a",
      sourceId: "source-a",
      status: "leased",
    });
    expect(await claimNextRefreshJob()).toBeUndefined();

    await completeRefreshJob(claimed!.id);
    expect(await claimNextRefreshJob()).toBeUndefined();
  });

  it("preserves retry backoff unless a user explicitly forces refresh", async () => {
    await enqueueSourceRefresh("source-b");
    const claimed = await claimNextRefreshJob();
    await retryRefreshJob(claimed!);

    await enqueueSourceRefresh("source-b");
    expect(await claimNextRefreshJob()).toBeUndefined();

    await enqueueSourceRefresh("source-b", { force: true });
    expect(await claimNextRefreshJob()).toMatchObject({ sourceId: "source-b" });
  });
});
