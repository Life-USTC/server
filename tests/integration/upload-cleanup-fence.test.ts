import { expect } from "vitest";
import { cleanupStaleUploadPendingStorage } from "@/features/uploads/server/upload-pending-cleanup";
import { uploadFinalizationTest as it } from "../shared/upload-finalization-fixture";

it("upload.completion-cleanup-fence", { tags: ["@Upload/Service"] }, async ({
  uploads,
  isolatedDatabase,
  protocolRuntime,
}) => {
  await protocolRuntime.run(async () => {
    const { db: fixturePrisma, bucket, upload, complete, run } = uploads;
    const key = await upload();
    bucket.beforeHead = async () => {
      await fixturePrisma.uploadPending.update({
        where: { key },
        data: { leaseExpiresAt: new Date(0) },
      });
      await run(() => cleanupStaleUploadPendingStorage(isolatedDatabase.app));
    };
    await expect(complete(key)).rejects.toMatchObject({
      code: "Upload session expired",
    });
    expect(bucket.objects.has(key)).toBe(false);
    expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);
    expect(await fixturePrisma.uploadPending.count({ where: { key } })).toBe(0);
  });
});
