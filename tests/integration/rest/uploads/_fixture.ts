import type { APIRequestContext } from "@playwright/test";
import {
  createUploadBucket,
  type UploadBucket,
} from "../../../e2e/utils/upload-bucket";
import {
  createFixturePrisma,
  type TestPrismaClient,
} from "../../../shared/prisma";
import { test as actorTest } from "../_harness/actor";

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
export const test = actorTest.extend<{
  uploadState: UploadState;
  uploadBucket: UploadBucket;
}>({
  uploadBucket: async ({ playwright, baseURL }, use) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        "x-test-storage-secret": "local-test-storage-observer",
      },
    });
    try {
      await use(createUploadBucket(request));
    } finally {
      await request.dispose();
    }
  },
  uploadState: async ({ createActor, uploadBucket: bucket }, use) => {
    const db = createFixturePrisma();
    const userIds: string[] = [];
    const cleanup = async () => {
      const results = await Promise.allSettled(
        userIds.map(async (userId) => {
          // The entire prefix belongs to this test, including keys from an
          // initialization response that failed before its JSON could be read.
          const keys: string[] = [];
          let cursor: string | undefined;
          do {
            const page = await bucket.list({
              prefix: `uploads/${userId}/`,
              ...(cursor ? { cursor } : {}),
            });
            keys.push(...page.objects.map(({ key }) => key));
            cursor = page.truncated ? page.cursor : undefined;
          } while (cursor);
          await Promise.all(keys.map((key) => bucket.delete(key)));
        }),
      );
      await db.$disconnect();
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(
          failures,
          "Owned upload object cleanup failed",
        );
    };
    try {
      const owner = await createActor();
      userIds.push(owner.id);
      const other = await createActor();
      userIds.push(other.id);
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
    } finally {
      await cleanup();
    }
  },
});
