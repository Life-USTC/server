import { expect, vi } from "vitest";
import {
  claimUploadCompletionLease,
  releaseUploadCompletionLease,
} from "@/features/uploads/server/upload-completion-lease";
import { uploadFinalizationTest } from "../shared/upload-finalization-fixture";

// One native case owns this worker's Date. No same-realm concurrent use.
const it = uploadFinalizationTest.extend<{ clock: undefined }>({
  clock: [
    async ({ protocolRuntime }, use) => {
      try {
        await use(undefined);
      } finally {
        // Keep Date until the complete workflow and all request cleanup finish.
        // The protocol runtime owner reports its cached original cleanup error.
        await Promise.allSettled([protocolRuntime.close()]);
        vi.useRealTimers();
      }
    },
    { auto: true },
  ],
});
it("upload.completion-lease-duration", { tags: ["@Upload/Service"] }, async ({
  uploads,
  protocolRuntime,
}) => {
  await protocolRuntime.run(async () => {
    const { db: fixturePrisma, userId, run, upload, complete } = uploads;
    const key = await upload();
    const now = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const first = await run(() => claimUploadCompletionLease(userId, key));
    if (!first) throw new Error("Expected initial completion lease");
    expect(
      (
        await fixturePrisma.uploadPending.findUniqueOrThrow({ where: { key } })
      ).leaseExpiresAt?.getTime(),
    ).toBe(now + 30000);
    vi.setSystemTime(now + 29999);
    expect(await run(() => claimUploadCompletionLease(userId, key))).toBeNull();
    vi.setSystemTime(now + 30000);
    const second = await run(() => claimUploadCompletionLease(userId, key));
    if (!second) throw new Error("Expected lease reclaim exactly at expiry");
    expect(second).not.toBe(first);
    const successor = await fixturePrisma.uploadPending.findUniqueOrThrow({
      where: { key },
    });
    expect(successor.leaseExpiresAt?.getTime()).toBe(now + 60000);
    await run(() => releaseUploadCompletionLease(userId, key, first));
    expect(
      await fixturePrisma.uploadPending.findUniqueOrThrow({ where: { key } }),
    ).toEqual(successor);
    await expect(complete(key)).rejects.toMatchObject({
      code: "Upload session expired",
    });
    expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);
    await run(() => releaseUploadCompletionLease(userId, key, second));
    expect((await complete(key)).upload.size).toBe(10);
  });
});
