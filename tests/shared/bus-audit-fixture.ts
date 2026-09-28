import type { RequestEvent } from "@sveltejs/kit";
import { makeSignature } from "better-auth/crypto";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { isolatedDatabaseTest } from "./isolated-database";
import type { TestPrismaClient } from "./prisma";
import { createWaitUntil } from "./wait-until";

type BusAudit = {
  db: TestPrismaClient;
  marker: string;
  userId: string;
  run<T>(work: () => T | Promise<T>): Promise<T>;
  event(
    id?: number,
    requestId?: string,
  ): Pick<RequestEvent, "locals" | "request">;
};

export const busAuditTest = isolatedDatabaseTest.extend<{ bus: BusAudit }>({
  bus: async ({ isolatedDatabase }, use) => {
    const db = isolatedDatabase.owner;
    const { connections } = isolatedDatabase;
    const marker = crypto.randomUUID();
    const userId = `bus-audit-${marker}`;
    const origin = "http://localhost:3000";
    const operations: Promise<void>[] = [];
    let cookie = "";
    function run<T>(work: () => T | Promise<T>): Promise<T> {
      const pending = createWaitUntil();
      const operation = (async () => {
        const [result] = await Promise.allSettled([
          runWithCloudflareRuntimeEnv(
            {
              APP_PUBLIC_ORIGIN: origin,
              HYPERDRIVE: { connectionString: connections.app },
              HYPERDRIVE_AUTH: { connectionString: connections.auth },
            },
            work,
            pending,
          ),
        ]);
        const [background] = await Promise.allSettled([pending.drain()]);
        if (result.status === "rejected") {
          if (background.status === "rejected")
            throw new AggregateError(
              [result.reason, background.reason],
              "Bus action and background work failed",
            );
          throw result.reason;
        }
        if (background.status === "rejected") throw background.reason;
        return result.value;
      })();
      operations.push(
        operation.then(
          () => undefined,
          () => undefined,
        ),
      );
      return operation;
    }
    function event(id?: number, requestId = "bus-audit-request") {
      const body = new FormData();
      if (id) body.set("id", String(id));
      return {
        locals: { locale: "en-us", requestId } as RequestEvent["locals"],
        request: new Request(`${origin}/admin/bus`, {
          method: "POST",
          headers: { cookie, origin },
          body,
        }),
      };
    }

    try {
      const token = crypto.randomUUID();
      await db.$transaction(async (tx) => {
        await tx.user.create({
          data: { id: userId, email: `${userId}@example.test`, isAdmin: true },
        });
        await tx.session.create({
          data: {
            userId,
            sessionToken: token,
            expires: new Date(Date.now() + 3600000),
          },
        });
        // Activation must disable another enabled version, including when
        // the audit insertion rolls back. Never rely on shared seed state.
        await tx.busScheduleVersion.create({
          data: {
            key: `previous-${marker}`,
            checksum: `previous-${marker}`,
            rawJson: {},
            title: `Previously enabled ${marker}`,
            isEnabled: true,
          },
        });
      });
      const context = await run(() => getBetterAuthInstance().$context);
      cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
      await use({ db, marker, userId, run, event });
    } finally {
      // Finish actual app-role requests before the owning fixture drops its DB.
      for (let index = 0; index < operations.length; index++)
        await operations[index];
    }
  },
});
