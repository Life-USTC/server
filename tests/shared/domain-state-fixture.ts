import { makeSignature } from "better-auth/crypto";
import { setCloudflareCatalogInvalidator } from "@/lib/adapters/cloudflare-runtime";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";
import type { TestPrismaClient } from "./prisma";

export type DomainState = {
  db: TestPrismaClient;
  marker: string;
  users: string[];
  cookies: Map<string, string>;
  runtime<T>(work: () => Promise<T>, connectionLabel?: string): Promise<T>;
  queueMessages: unknown[];
};

export const domainStateTest = isolatedDatabaseTest.extend<{
  suspendedIsAdmin: boolean;
  domainQueue: { messages: unknown[]; send(message: unknown): Promise<void> };
  domainRuntime: DomainState["runtime"];
  state: DomainState;
}>({
  suspendedIsAdmin: true,
  // Direct domain contracts observe enqueue intent; real queue delivery and
  // rate limits remain separate Worker contracts.
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  domainQueue: async ({}, use) => {
    const messages: unknown[] = [];
    await use({
      messages,
      send: async (message) => {
        messages.push(message);
      },
    });
  },
  domainRuntime: async (
    { isolatedDatabase, domainQueue, onTestFinished },
    use,
  ) => {
    const runtimes: ReturnType<typeof createNodeRuntime>[] = [];
    let closed = false;
    const run: DomainState["runtime"] = (work, connectionLabel) => {
      if (closed) return Promise.reject(new Error("Domain runtime is closed"));
      const connection = new URL(isolatedDatabase.connections.app);
      if (connectionLabel)
        connection.searchParams.set("application_name", connectionLabel);
      const runtime = createNodeRuntime({
        APP_PUBLIC_ORIGIN: "http://localhost:3000",
        HYPERDRIVE: { connectionString: connection.href },
        HYPERDRIVE_AUTH: {
          connectionString: isolatedDatabase.connections.auth,
        },
        HYPERDRIVE_MAINTENANCE: {
          connectionString: isolatedDatabase.connections.maintenance,
        },
        USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
        USER_BATCH_WRITE_RATE_LIMITER: {
          limit: async () => ({ success: true }),
        },
        CALENDAR_EXPORT_REBUILD: domainQueue,
      });
      // Own each labelled request before any asynchronous work can start.
      runtimes.push(runtime);
      return runtime.run(async () => {
        // Direct Node contracts have no Worker HTML cache.
        setCloudflareCatalogInvalidator(async () => {});
        return work();
      });
    };
    const failures: unknown[] = [];
    try {
      await use(run);
    } catch (error) {
      failures.push(error);
    }
    closed = true;
    const results = await Promise.allSettled(runtimes.map((r) => r.close()));
    failures.push(
      ...results.flatMap((r) => (r.status === "rejected" ? [r.reason] : [])),
    );
    if (failures.length) {
      const error = new AggregateError(
        failures,
        "Domain runtime cleanup failed",
      );
      onTestFinished(() => {
        throw error;
      });
    }
  },
  state: async (
    { suspendedIsAdmin, isolatedDatabase, domainRuntime, domainQueue },
    use,
  ) => {
    const db = isolatedDatabase.owner;
    const marker = crypto.randomUUID();
    const users = ["owner", "other", "admin", "suspended"];
    const cookies = new Map<string, string>();
    await domainRuntime(async () => {
      // Private local IDs can repeat across cases. Give persisted catalog
      // revisions independent cache keys before any application read.
      await db.staticImportState.create({
        data: {
          id: "global",
          snapshotSha256: marker.replaceAll("-", "").repeat(2),
          snapshotGeneratedAt: new Date(),
          transformRevision: 6,
        },
      });
      const context = await getBetterAuthInstance().$context;
      // Atomic acquisition leaves no partially constructed actor set.
      await db.$transaction(async (tx) => {
        for (const [index, id] of users.entries()) {
          await tx.user.create({
            data: {
              id,
              name: id,
              email: `${id}@test.invalid`,
              isAdmin: index === 2 || (index === 3 && suspendedIsAdmin),
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
    });
    await use({
      db,
      marker,
      users,
      cookies,
      runtime: domainRuntime,
      queueMessages: domainQueue.messages,
    });
  },
});
