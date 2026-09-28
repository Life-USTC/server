import { makeSignature } from "better-auth/crypto";
import { test } from "vitest";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareCatalogInvalidator,
} from "@/lib/adapters/cloudflare-runtime";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createFixturePrisma, type TestPrismaClient } from "./prisma";

export type DomainState = {
  db: TestPrismaClient;
  marker: string;
  users: string[];
  cookies: Map<string, string>;
  runtime<T>(work: () => Promise<T>, connectionLabel?: string): Promise<T>;
  queueMessages: unknown[];
};

export const domainStateTest = test.extend<{ state: DomainState }>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  state: async ({}, use) => {
    const db = createFixturePrisma();
    const marker = crypto.randomUUID();
    const users = ["owner", "other", "admin", "suspended"].map(
      (role) => `${role}-${marker}`,
    );
    const cookies = new Map<string, string>();
    const queueMessages: unknown[] = [];
    const responses: Response[] = [];
    async function runtime<T>(
      work: () => Promise<T>,
      connectionLabel?: string,
    ) {
      if (!process.env.DATABASE_URL || !process.env.AUTH_DATABASE_URL)
        throw new Error(
          "Domain tests require restricted runtime database URLs",
        );
      const connection = new URL(process.env.DATABASE_URL);
      if (connectionLabel)
        connection.searchParams.set("application_name", connectionLabel);
      const tasks: Promise<unknown>[] = [];
      const result = await runWithCloudflareRuntimeEnv(
        {
          APP_PUBLIC_ORIGIN: "http://localhost:3000",
          HYPERDRIVE: { connectionString: connection.href },
          HYPERDRIVE_AUTH: { connectionString: process.env.AUTH_DATABASE_URL },
          HYPERDRIVE_MAINTENANCE: {
            connectionString: process.env.MAINTENANCE_DATABASE_URL,
          },
          // Rate-limit behavior has its own binding tests; this fixture
          // exercises real authentication, permissions and domain mutations.
          USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
          USER_BATCH_WRITE_RATE_LIMITER: {
            limit: async () => ({ success: true }),
          },
          CALENDAR_EXPORT_REBUILD: {
            send: async (message: unknown) => {
              queueMessages.push(message);
            },
          },
        },
        async () => {
          // These direct domain tests have no Worker HTML cache. Production
          // invalidation is tested separately through real Worker entry points.
          setCloudflareCatalogInvalidator(async () => {});
          const [outcome] = await Promise.allSettled([work()]);
          const failures: unknown[] = [];
          // Drain tasks before runtime Prisma disconnects, including tasks
          // scheduled by other background work and rejected operations.
          for (let start = 0; start < tasks.length; ) {
            const batch = tasks.slice(start);
            start += batch.length;
            for (const result of await Promise.allSettled(batch)) {
              if (result.status === "rejected") failures.push(result.reason);
            }
          }
          if (outcome.status === "rejected") {
            if (!failures.length) throw outcome.reason;
            throw new AggregateError(
              [outcome.reason, ...failures],
              "Domain work and background work failed",
            );
          }
          if (failures.length)
            throw new AggregateError(failures, "Domain background work failed");
          return outcome.value;
        },
        { waitUntil: (task: Promise<unknown>) => tasks.push(task) },
      );
      if (result instanceof Response) responses.push(result);
      return result;
    }
    async function cleanup() {
      try {
        const cancellations = await Promise.allSettled(
          responses.map((response) =>
            response.body && !response.bodyUsed
              ? response.body.cancel()
              : undefined,
          ),
        );
        await db.$transaction(async (tx) => {
          await tx.auditLog.deleteMany({
            where: {
              OR: [{ userId: { in: users } }, { subjectUserId: { in: users } }],
            },
          });
          await tx.featureOperationEvent.deleteMany({
            where: { userId: { in: users } },
          });
          await tx.upload.deleteMany({ where: { userId: { in: users } } });
          await tx.user.deleteMany({ where: { id: { in: users } } });
        });
        const failures = cancellations.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (failures.length)
          throw new AggregateError(failures, "Domain response cleanup failed");
      } finally {
        await db.$disconnect();
      }
    }
    try {
      const context = await runtime(() => getBetterAuthInstance().$context);
      // Atomic acquisition leaves no partially constructed actor set.
      await db.$transaction(async (tx) => {
        for (const [index, id] of users.entries()) {
          await tx.user.create({
            data: {
              id,
              name: id,
              email: `${id}@test.invalid`,
              isAdmin: index >= 2,
            },
          });
          const token = crypto.randomUUID();
          await tx.session.create({
            data: {
              userId: id,
              sessionToken: token,
              expires: new Date(Date.now() + 3600000),
            },
          });
          cookies.set(
            id,
            `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`,
          );
        }
        await tx.userSuspension.create({
          data: { userId: users[3], createdById: users[2], reason: marker },
        });
      });
      await use({ db, marker, users, cookies, runtime, queueMessages });
    } finally {
      await cleanup();
    }
  },
});
