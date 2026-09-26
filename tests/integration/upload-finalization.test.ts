import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { cleanupStaleUploadPendingStorage } from "@/features/uploads/server/upload-pending-cleanup";
import {
  claimUploadPutLease,
  completeUploadSession,
  createUploadSession,
  markUploadPutCompleted,
} from "@/features/uploads/server/upload-service";
import {
  type CloudflareR2Bucket,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import { createDeferred } from "../shared/deferred";
import { createFixturePrisma } from "../shared/prisma";

const fixturePrisma = createFixturePrisma();
class MemoryR2Bucket implements CloudflareR2Bucket {
  objects = new Map<string, number>();
  beforeHead: (() => Promise<void>) | undefined;
  headCalls = 0;
  async head(key: string) {
    expect(getUserRlsTransactionClient()).toBeUndefined();
    this.headCalls += 1;
    const size = this.objects.get(key);
    await this.beforeHead?.();
    return size == null
      ? null
      : { size, httpMetadata: { contentType: "text/plain" } };
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async get() {
    return null;
  }
  async put() {}
}
const bucket = new MemoryR2Bucket();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for upload tests");
const runtimeEnv = {
  DATABASE_URL: databaseUrl,
  HYPERDRIVE: { connectionString: databaseUrl },
  NODE_ENV: "test",
  R2_UPLOADS: bucket,
};
let userId: string;

function run<T>(work: () => Promise<T>) {
  return runWithCloudflareRuntimeEnv(runtimeEnv, work);
}

async function upload(size = 10) {
  const session = await run(() =>
    createUploadSession({
      origin: "https://example.test",
      upload: { contentType: "text/plain", filename: "test.txt", size: 1024 },
      userId,
    }),
  );
  await put(session.key, size);
  return session.key;
}

async function put(key: string, size: number) {
  const lease = await run(() =>
    claimUploadPutLease({
      key,
      requestContentLength: size,
      requestContentType: "text/plain",
      userId,
    }),
  );
  bucket.objects.set(key, size);
  await run(() => markUploadPutCompleted({ ...lease, key, userId }));
}

function complete(key: string, filename = "test.txt") {
  return run(() => completeUploadSession(userId, { filename, key }));
}

beforeEach(async () => {
  bucket.objects.clear();
  bucket.beforeHead = undefined;
  bucket.headCalls = 0;
  const user = await fixturePrisma.user.create({
    data: {
      email: `upload-finalization-${crypto.randomUUID()}@example.test`,
      name: "[integration-test] Upload finalization",
    },
  });
  userId = user.id;
});

afterEach(async () => {
  await fixturePrisma.uploadPending.deleteMany({ where: { userId } });
  await fixturePrisma.upload.deleteMany({ where: { userId } });
  await fixturePrisma.user.delete({ where: { id: userId } });
});

afterAll(() => fixturePrisma.$disconnect());

describe("upload finalization ownership", () => {
  it("prevents a PUT from replacing the object between HEAD and quota settlement", async () => {
    const key = await upload();
    const headStarted = createDeferred<void>();
    const releaseHead = createDeferred<void>();
    bucket.beforeHead = async () => {
      headStarted.resolve();
      await releaseHead.promise;
    };

    const completion = complete(key);
    await headStarted.promise;
    const replacement = await put(key, 1024).then(
      () => "uploaded",
      (error: Error) => error.message,
    );
    releaseHead.resolve();
    const result = await completion;
    const stored = await fixturePrisma.upload.findUniqueOrThrow({
      where: { key },
    });

    expect(stored.size).toBe(bucket.objects.get(key));
    expect(result.usedBytes).toBe(stored.size);
    expect(replacement).toBe("Upload session expired");
    expect(stored.size).toBe(10);
  });

  it.each(["reserved", "uploading", "cleaning"] as const)(
    "rejects %s reservations before inspecting storage",
    async (phase) => {
      const key = await upload();
      await fixturePrisma.uploadPending.update({
        where: { key },
        data: { phase },
      });
      await expect(complete(key)).rejects.toMatchObject({
        code: "Upload session expired",
      });
      expect(bucket.headCalls).toBe(0);
      expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);
    },
  );

  it("rejects concurrent completion then returns the committed upload on retry", async () => {
    const key = await upload();
    const headStarted = createDeferred<void>();
    const releaseHead = createDeferred<void>();
    bucket.beforeHead = async () => {
      headStarted.resolve();
      await releaseHead.promise;
    };
    const first = complete(key, "first.txt");
    await headStarted.promise;
    const second = await complete(key, "second.txt").catch((error) => error);
    releaseHead.resolve();
    const firstResult = await first;

    expect(second).toMatchObject({ code: "Upload session expired" });
    const retry = await complete(key, "retry.txt");
    expect(retry.upload).toEqual(firstResult.upload);
    expect(retry.upload.filename).toBe("first.txt");
    expect(bucket.headCalls).toBe(1);
  });

  it.each(["missing", "unavailable", "oversized"])(
    "releases a completion with a %s object so the owner can retry",
    async (failure) => {
      const key = await upload();
      if (failure === "missing") bucket.objects.delete(key);
      if (failure === "oversized") {
        bucket.objects.set(key, uploadConfig.maxFileSizeBytes + 1);
      }
      if (failure === "unavailable") {
        bucket.beforeHead = async () => {
          throw new Error("Storage unavailable");
        };
      }

      await expect(complete(key)).rejects.toThrow();
      expect(
        await fixturePrisma.uploadPending.findUniqueOrThrow({ where: { key } }),
      ).toMatchObject({ phase: "uploaded", leaseExpiresAt: null });
      expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);

      bucket.beforeHead = undefined;
      await put(key, 20);
      const result = await complete(key);
      expect(result.upload.size).toBe(20);
      expect(result.usedBytes).toBe(20);
    },
  );

  it.each(["failed", "successful"])(
    "does not let a stale %s HEAD release or settle a successor's lease",
    async (outcome) => {
      const key = await upload();
      const firstStarted = createDeferred<void>();
      const releaseFirst = createDeferred<void>();
      const secondStarted = createDeferred<void>();
      const releaseSecond = createDeferred<void>();
      let heads = 0;
      bucket.beforeHead = async () => {
        heads += 1;
        if (heads === 1) {
          firstStarted.resolve();
          await releaseFirst.promise;
          if (outcome === "failed") throw new Error("Storage unavailable");
        } else {
          secondStarted.resolve();
          await releaseSecond.promise;
        }
      };

      const first = complete(key, "stale.txt").catch((error) => error);
      await firstStarted.promise;
      const oldClaim = await fixturePrisma.uploadPending.update({
        where: { key },
        data: { leaseExpiresAt: new Date(0) },
      });
      const second = complete(key, "current.txt");
      await secondStarted.promise;
      const newClaim = await fixturePrisma.uploadPending.findUniqueOrThrow({
        where: { key },
      });
      releaseFirst.resolve();
      const staleResult = await first;
      const claimAfterStaleResult =
        await fixturePrisma.uploadPending.findUniqueOrThrow({ where: { key } });
      releaseSecond.resolve();
      const result = await second;

      expect(newClaim.attemptId).not.toBe(oldClaim.attemptId);
      expect(staleResult).toBeInstanceOf(Error);
      expect(claimAfterStaleResult).toMatchObject({
        attemptId: newClaim.attemptId,
        phase: "completing",
      });
      expect(result.upload.filename).toBe("current.txt");
      expect(result.usedBytes).toBe(10);
    },
  );

  it.each(["reservation", "lease"])(
    "does not settle after %s expiry during HEAD",
    async (expired) => {
      const key = await upload();
      bucket.beforeHead = async () => {
        await fixturePrisma.uploadPending.update({
          where: { key },
          data:
            expired === "reservation"
              ? { expiresAt: new Date(0) }
              : { leaseExpiresAt: new Date(0) },
        });
      };
      await expect(complete(key)).rejects.toMatchObject({
        code: "Upload session expired",
      });
      expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);
      expect(bucket.objects.get(key)).toBe(10);
      expect(
        await fixturePrisma.uploadPending.findUniqueOrThrow({ where: { key } }),
      ).toMatchObject({ phase: "uploaded", leaseExpiresAt: null });
      if (expired === "lease") {
        bucket.beforeHead = undefined;
        expect((await complete(key)).upload.size).toBe(10);
      }
    },
  );

  it("does not create metadata after cleanup takes an expired completion lease", async () => {
    const key = await upload();
    bucket.beforeHead = async () => {
      await fixturePrisma.uploadPending.update({
        where: { key },
        data: { leaseExpiresAt: new Date(0) },
      });
      await run(() => cleanupStaleUploadPendingStorage(fixturePrisma));
    };
    await expect(complete(key)).rejects.toMatchObject({
      code: "Upload session expired",
    });
    expect(bucket.objects.has(key)).toBe(false);
    expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);
    expect(await fixturePrisma.uploadPending.count({ where: { key } })).toBe(0);
  });

  it("expires a quota-rejected reservation without leaving a completion lease", async () => {
    const key = await upload();
    await fixturePrisma.upload.create({
      data: {
        filename: "quota.txt",
        key: `uploads/${userId}/quota`,
        size: uploadConfig.totalQuotaBytes,
        userId,
      },
    });
    await expect(complete(key)).rejects.toMatchObject({
      code: "Quota exceeded",
    });
    const pending = await fixturePrisma.uploadPending.findUniqueOrThrow({
      where: { key },
    });
    expect(pending.phase).toBe("uploaded");
    expect(pending.leaseExpiresAt).toBeNull();
    expect(pending.expiresAt.getTime()).toBeLessThan(Date.now());
    expect(bucket.objects.get(key)).toBe(10);
    expect(await fixturePrisma.upload.count({ where: { key } })).toBe(0);
  });

  it("rolls back an oversized PUT claim so a corrected PUT can proceed", async () => {
    const key = await upload();
    await expect(put(key, 2048)).rejects.toMatchObject({
      code: "File too large",
    });
    expect(
      await fixturePrisma.uploadPending.findUniqueOrThrow({ where: { key } }),
    ).toMatchObject({ phase: "uploaded", leaseExpiresAt: null });
    await put(key, 20);
    expect((await complete(key)).upload.size).toBe(20);
  });
});
