import { makeSignature } from "better-auth/crypto";
import { expect, test } from "vitest";
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
import { getUploadsRoute } from "@/lib/api/routes/upload-management-routes";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import { createDeferred } from "./deferred";
import { isolatedDatabaseTest } from "./isolated-database";
import { createFixturePrisma, type TestPrismaClient } from "./prisma";

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

type UploadFinalization = {
  db: TestPrismaClient;
  bucket: MemoryUploadBucket;
  userId: string;
  run<T>(work: () => T | Promise<T>): Promise<T>;
  defer(): ReturnType<typeof createDeferred<void>>;
  upload(size?: number): Promise<string>;
  put(key: string, size: number): Promise<void>;
  complete(
    key: string,
    filename?: string,
  ): ReturnType<typeof completeUploadSession>;
  list(params?: string): Promise<Response>;
};

async function useUploadFinalization(
  db: TestPrismaClient,
  connections: { app: string; auth: string },
  use: (state: UploadFinalization) => Promise<void>,
) {
  const userId = `upload-finalization-${crypto.randomUUID()}`;
  const bucket = new MemoryUploadBucket();
  const responses = new Set<Response>();
  const operations: Promise<void>[] = [];
  const gates: ReturnType<typeof createDeferred<void>>[] = [];
  let cookie = "";
  function run<T>(work: () => T | Promise<T>): Promise<T> {
    const tasks: Promise<PromiseSettledResult<unknown>>[] = [];
    const operation = runWithCloudflareRuntimeEnv(
      {
        APP_PUBLIC_ORIGIN: "http://localhost:3000",
        HYPERDRIVE: { connectionString: connections.app },
        HYPERDRIVE_AUTH: { connectionString: connections.auth },
        R2_UPLOADS: bucket,
      },
      async () => {
        const [outcome] = await Promise.allSettled([
          Promise.resolve().then(work),
        ]);
        const failures: unknown[] = [];
        for (let index = 0; index < tasks.length; index++) {
          const result = await tasks[index];
          if (result.status === "rejected") failures.push(result.reason);
        }
        if (outcome.status === "rejected") {
          if (!failures.length) throw outcome.reason;
          throw new AggregateError(
            [outcome.reason, ...failures],
            "Upload request failed",
          );
        }
        if (failures.length) {
          if (outcome.value instanceof Response) responses.add(outcome.value);
          throw new AggregateError(failures, "Upload background work failed");
        }
        return outcome.value;
      },
      {
        waitUntil: (task: Promise<unknown>) => {
          tasks.push(
            task.then(
              (value) => ({ status: "fulfilled" as const, value }),
              (reason) => ({ status: "rejected" as const, reason }),
            ),
          );
        },
      },
    ).then((result) => {
      if (result instanceof Response) responses.add(result);
      return result;
    });
    // Tests assert the returned rejection. Teardown independently waits for
    // every started operation, even when an assertion interrupts a HEAD race.
    operations.push(
      operation.then(
        () => undefined,
        () => undefined,
      ),
    );
    return operation;
  }
  function defer() {
    const gate = createDeferred<void>();
    gates.push(gate);
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
        upload: { contentType: "text/plain", filename: "test.txt", size: 1024 },
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
        new Request(`http://localhost:3000/api/workspace/uploads${params}`, {
          headers: { cookie },
        }),
      ),
    );
  }
  async function cleanup() {
    for (const gate of gates) gate.resolve();
    for (let index = 0; index < operations.length; index++)
      await operations[index];
    const cancellations = await Promise.allSettled(
      [...responses].map((response) =>
        response.body && !response.bodyUsed
          ? response.body.cancel()
          : undefined,
      ),
    );
    try {
      await db.$transaction(async (tx) => {
        await tx.auditLog.deleteMany({
          where: { OR: [{ userId }, { subjectUserId: userId }] },
        });
        await tx.featureOperationEvent.deleteMany({ where: { userId } });
        await tx.uploadPending.deleteMany({ where: { userId } });
        await tx.upload.deleteMany({ where: { userId } });
        await tx.user.deleteMany({ where: { id: userId } });
      });
    } finally {
      bucket.beforeHead = undefined;
      bucket.objects.clear();
    }
    const failures = cancellations.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length)
      throw new AggregateError(failures, "Upload response cleanup failed");
  }
  try {
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
    cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
    await use({ db, bucket, userId, run, defer, upload, put, complete, list });
  } finally {
    await cleanup();
  }
}

export const uploadFinalizationTest = test.extend<{
  uploads: UploadFinalization;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  uploads: async ({}, use) => {
    const db = createFixturePrisma();
    try {
      const app = process.env.DATABASE_URL;
      const auth = process.env.AUTH_DATABASE_URL;
      if (!app || !auth)
        throw new Error(
          "Upload tests require restricted app and auth database URLs",
        );
      await useUploadFinalization(db, { app, auth }, use);
    } finally {
      await db.$disconnect();
    }
  },
});

export const isolatedUploadFinalizationTest = isolatedDatabaseTest.extend<{
  uploads: UploadFinalization;
}>({
  uploads: async ({ isolatedDatabase }, use) => {
    await useUploadFinalization(
      isolatedDatabase.owner,
      isolatedDatabase.connections,
      use,
    );
  },
});
