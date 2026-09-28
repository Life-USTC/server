import { type APIRequestContext, expect } from "@playwright/test";
import {
  createFixturePrisma,
  type TestPrismaClient,
} from "../../../shared/prisma";
import { test as actorTest } from "../_harness/actor";

type Actor = { id: string; request: APIRequestContext };
type UploadBucket = {
  put(
    key: string,
    contents: string,
    options: { httpMetadata: { contentType: string } },
  ): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array<ArrayBuffer> } | null>;
  head(
    key: string,
  ): Promise<{ size: number; httpMetadata: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    objects: Array<{ key: string }>;
    truncated: boolean;
    cursor?: string;
  }>;
};
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
    const path = "/__test/storage/uploads";
    try {
      await use({
        async put(key, contents, options) {
          const response = await request.put(path, {
            params: { key },
            data: Buffer.from(contents),
            headers: { "content-type": options.httpMetadata.contentType },
          });
          expect(response.status(), await response.text()).toBe(204);
        },
        async get(key) {
          const response = await request.get(path, { params: { key } });
          if (response.status() === 404) return null;
          expect(response.status(), await response.text()).toBe(200);
          return { body: Uint8Array.from(await response.body()) };
        },
        async head(key) {
          const response = await request.get(path, {
            params: { key, metadata: "1" },
          });
          expect(response.status(), await response.text()).toBe(200);
          return response.json();
        },
        async delete(key) {
          const response = await request.delete(path, { params: { key } });
          expect(response.status(), await response.text()).toBe(204);
        },
        async list(options) {
          const response = await request.get(path, { params: options });
          expect(response.status(), await response.text()).toBe(200);
          return response.json();
        },
      });
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
