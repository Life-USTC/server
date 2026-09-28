import type { APIRequestContext } from "@playwright/test";
import {
  type IsolatedWorker,
  test as isolatedTest,
} from "../../../e2e/utils/isolated-worker";
import {
  createUploadBucket,
  type UploadBucket,
} from "../../../e2e/utils/upload-bucket";
import type { TestPrismaClient } from "../../../shared/prisma";

type Actor = { id: string; request: APIRequestContext };
type UploadState = {
  owner: Actor;
  other: Actor;
  db: TestPrismaClient;
  bucket: UploadBucket;
  knownUpload: (options?: {
    userId?: string;
    filename?: string;
    contents?: string;
    createdAt?: Date;
  }) => Promise<{
    id: string;
    key: string;
    filename: string;
    size: number;
    contents: string;
  }>;
  pending: (options?: {
    userId?: string;
    size?: number;
    expiresAt?: Date;
    phase?: "reserved" | "uploaded";
    contents?: string;
  }) => Promise<{
    id: string;
    key: string;
    filename: string;
    size: number;
  }>;
};

export const base = "/api/workspace/uploads";
export const test = isolatedTest.extend<{
  createActor: IsolatedWorker["createActor"];
  uploadState: UploadState;
  uploadBucket: UploadBucket;
}>({
  createActor: async ({ isolatedWorker }, use) => {
    await use(isolatedWorker.createActor);
  },
  uploadBucket: async ({ request, isolatedWorker }, use) => {
    await use(createUploadBucket(request, isolatedWorker.origin));
  },
  uploadState: async (
    { isolatedWorker, createActor, uploadBucket: bucket },
    use,
  ) => {
    const db = isolatedWorker.database.owner;
    const owner = await createActor();
    const other = await createActor();
    const userIds = [owner.id, other.id];
    await use({
      owner,
      other,
      db,
      bucket,
      knownUpload: async ({
        userId = owner.id,
        filename = "known.txt",
        contents = "known object bytes",
        createdAt,
      } = {}) => {
        if (!userIds.includes(userId))
          throw new Error("Upload fixtures require an owned actor");
        const key = `uploads/${userId}/${crypto.randomUUID()}`;
        await bucket.put(key, contents, {
          httpMetadata: { contentType: "text/plain" },
        });
        const upload = await db.upload.create({
          data: {
            key,
            filename,
            size: Buffer.byteLength(contents),
            contentType: "text/plain",
            userId,
            ...(createdAt ? { createdAt } : {}),
          },
        });
        return { ...upload, contents };
      },
      pending: async ({
        userId = owner.id,
        size = 5,
        expiresAt = new Date(Date.now() + 300_000),
        phase = "reserved",
        contents,
      } = {}) => {
        if (!userIds.includes(userId))
          throw new Error("Upload fixtures require an owned actor");
        const key = `uploads/${userId}/${crypto.randomUUID()}`;
        const pending = await db.uploadPending.create({
          data: {
            userId,
            key,
            filename: "pending.txt",
            size,
            contentType: "text/plain",
            expiresAt,
            phase,
            attemptId: crypto.randomUUID(),
          },
        });
        if (contents !== undefined)
          await bucket.put(key, contents, {
            httpMetadata: { contentType: "text/plain" },
          });
        return pending;
      },
    });
  },
});
