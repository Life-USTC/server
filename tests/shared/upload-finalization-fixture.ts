import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import {
  claimUploadPutLease,
  completeUploadSession,
  createUploadSession,
  markUploadPutCompleted,
} from "@/features/uploads/server/upload-service";
import type { CloudflareR2Bucket } from "@/lib/adapters/cloudflare-runtime";
import { getUploadsRoute } from "@/lib/api/routes/upload-management-routes";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import { createDeferred } from "./deferred";
import { mcpProtocolTest } from "./mcp-protocol-fixture";

class MemoryUploadBucket implements CloudflareR2Bucket {
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

const uploadBucketTest = mcpProtocolTest.extend<{
  uploadBucket: MemoryUploadBucket;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  uploadBucket: async ({}, use) => {
    const bucket = new MemoryUploadBucket();
    try {
      await use(bucket);
    } finally {
      // protocolBindings depends on this bucket, so request and SDK owners
      // finish before its in-memory objects and HEAD observer are released.
      bucket.beforeHead = undefined;
      bucket.objects.clear();
    }
  },
});

export const uploadFinalizationTest = uploadBucketTest
  .extend({
    protocolBindings: async ({ uploadBucket }, use) => {
      await use({ R2_UPLOADS: uploadBucket });
    },
  })
  .extend(
    "uploads",
    async (
      {
        isolatedDatabase: { owner: db },
        protocolRuntime,
        uploadBucket: bucket,
        mcpSessions: _mcpSessions,
      },
      { onCleanup },
    ) => {
      const gates: ReturnType<typeof createDeferred<void>>[] = [];
      let finishing = false;
      // Release race gates before the runtime owner drains admitted workflows.
      // The private database owns rows; no shared-user restoration is necessary.
      // The SDK dependency places this gate release before session cleanup drains.
      onCleanup(() => {
        finishing = true;
        for (const gate of gates) gate.resolve();
      });
      const run = protocolRuntime.request;
      const userId = `upload-finalization-${crypto.randomUUID()}`;
      const cookie = await protocolRuntime.run(async () => {
        const context = await run(() => getBetterAuthInstance().$context);
        const token = crypto.randomUUID();
        await db.$transaction(async (tx) => {
          await tx.user.create({
            data: {
              id: userId,
              email: `${userId}@test.invalid`,
              name: "[integration-test] Upload finalization",
            },
          });
          await tx.session.create({
            data: {
              userId,
              sessionToken: token,
              expires: new Date(Date.now() + 3600000),
            },
          });
        });
        return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
      });
      function defer() {
        const gate = createDeferred<void>();
        if (finishing) gate.resolve();
        else gates.push(gate);
        return gate;
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
      async function upload(size = 10) {
        const session = await run(() =>
          createUploadSession({
            origin: "https://example.test",
            upload: {
              contentType: "text/plain",
              filename: "test.txt",
              size: 1024,
            },
            userId,
          }),
        );
        await put(session.key, size);
        return session.key;
      }
      function complete(key: string, filename = "test.txt") {
        return run(() => completeUploadSession(userId, { filename, key }));
      }
      function list(params = "") {
        return run(() =>
          getUploadsRoute(
            new Request(
              `http://localhost:3000/api/workspace/uploads${params}`,
              { headers: { cookie } },
            ),
          ),
        );
      }
      return { db, bucket, userId, run, defer, upload, put, complete, list };
    },
  );
