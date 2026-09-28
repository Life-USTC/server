import { makeSignature } from "better-auth/crypto";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { getCanonicalOAuthIssuer } from "@/lib/oauth/resource-urls";
import { isolatedDatabaseTest } from "./isolated-database";
import type { TestPrismaClient } from "./prisma";
import { createWaitUntil } from "./wait-until";

type AdminGovernance = {
  db: TestPrismaClient;
  app: TestPrismaClient;
  marker: string;
  origin: string;
  adminId: string;
  userId: string;
  secondUserId: string;
  cookie: string;
  userCookie: string;
  token: string;
  commentIds: string[];
  run<T>(work: () => T | Promise<T>): Promise<T>;
  request(
    path: string,
    method?: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Request;
};

export const adminGovernanceTest = isolatedDatabaseTest.extend<{
  governance: AdminGovernance;
}>({
  governance: async ({ isolatedDatabase }, use) => {
    const db = isolatedDatabase.owner;
    const { connections, app } = isolatedDatabase;
    const marker = crypto.randomUUID();
    const adminId = `governance-admin-${marker}`;
    const userId = `governance-user-${marker}`;
    const secondUserId = `governance-second-${marker}`;
    const clientId = `governance-client-${marker}`;
    const grantId = `governance-grant-${marker}`;
    const origin = "http://localhost:3000";
    const commentIds = [0, 1, 2].map(
      (index) => `governance-comment-${marker}-${index}`,
    );
    const responses = new Set<Response>();
    const operations: Promise<void>[] = [];
    let cookie = "";
    let userCookie = "";

    function run<T>(work: () => T | Promise<T>): Promise<T> {
      const pending = createWaitUntil();
      const operation = (async () => {
        const [result] = await Promise.allSettled([
          runWithCloudflareRuntimeEnv(
            {
              APP_PUBLIC_ORIGIN: origin,
              HYPERDRIVE: { connectionString: connections.app },
              HYPERDRIVE_AUTH: { connectionString: connections.auth },
              HYPERDRIVE_MAINTENANCE: {
                connectionString: connections.maintenance,
              },
              // Rate-limit enforcement has separate binding contracts; these
              // cases exercise the real session and governance checks.
              USER_WRITE_RATE_LIMITER: {
                limit: async () => ({ success: true }),
              },
            },
            work,
            pending,
          ),
        ]);
        if (result.status === "fulfilled" && result.value instanceof Response)
          responses.add(result.value);
        const [background] = await Promise.allSettled([pending.drain()]);
        if (result.status === "rejected") {
          if (background.status === "rejected")
            throw new AggregateError(
              [result.reason, background.reason],
              "Admin request and background work failed",
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
    function request(
      path: string,
      method = "GET",
      body?: unknown,
      headers: Record<string, string> = { cookie },
    ) {
      return new Request(`${origin}${path}`, {
        method,
        headers: {
          origin,
          ...headers,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }
    async function cleanup() {
      for (let index = 0; index < operations.length; index++)
        await operations[index];
      const settled = await Promise.allSettled(
        [...responses].map((response) =>
          response.body && !response.bodyUsed
            ? response.body.cancel()
            : undefined,
        ),
      );
      const failures = settled.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "Admin response cleanup failed");
    }

    try {
      const context = await run(() => getBetterAuthInstance().$context);
      const resources = await run(() => [getCanonicalOAuthIssuer()]);
      const adminSession = crypto.randomUUID();
      const userSession = crypto.randomUUID();
      // All population, catalog, credentials and moderation queues belong to
      // this empty database. A setup failure cannot expose partial shared data.
      await db.$transaction(async (tx) => {
        await tx.user.createMany({
          data: [adminId, userId, secondUserId].map((id) => ({
            id,
            email: `${id}@example.test`,
            name: `${marker}-${id}`,
            isAdmin: id === adminId,
          })),
        });
        await tx.session.createMany({
          data: [
            {
              userId: adminId,
              sessionToken: adminSession,
              expires: new Date(Date.now() + 3600000),
            },
            {
              userId,
              sessionToken: userSession,
              expires: new Date(Date.now() + 3600000),
            },
          ],
        });
        await tx.oAuthClient.create({
          data: {
            clientId,
            name: "Governance bearer",
            tokenEndpointAuthMethod: "none",
            scopes: ["workspace.todo:read"],
            consents: {
              create: {
                grantId,
                userId: adminId,
                scopes: ["workspace.todo:read"],
                resources,
              },
            },
          },
        });
        const course = await tx.course.create({
          data: {
            jwId: 1,
            code: `course-${marker}`,
            nameCn: "Governance fixture",
          },
        });
        const section = await tx.section.create({
          data: { jwId: 1, code: `section-${marker}`, courseId: course.id },
        });
        for (let index = 0; index < 3; index++) {
          const homework = await tx.homework.create({
            data: {
              title: `${marker}-${index}`,
              sectionId: section.id,
              createdById: userId,
              description: { create: { content: `${marker}-${index}` } },
            },
          });
          await tx.comment.create({
            data: {
              id: commentIds[index],
              body: `${marker}-${index}`,
              userId,
              homeworkId: homework.id,
            },
          });
        }
      });
      cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${adminSession}.${await makeSignature(adminSession, context.secret)}`)}`;
      userCookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${userSession}.${await makeSignature(userSession, context.secret)}`)}`;
      const token = await run(() =>
        signResourceBoundOAuthAccessToken({
          clientId,
          userId: adminId,
          grantId,
          resources,
          scopes: ["workspace.todo:read"],
          issuedAt: Math.floor(Date.now() / 1000),
          expiresAt: Math.floor(Date.now() / 1000) + 600,
        }),
      );
      if (!token) throw new Error("Expected signed administrator token");
      await use({
        db,
        app,
        marker,
        origin,
        adminId,
        userId,
        secondUserId,
        cookie,
        userCookie,
        token,
        commentIds,
        run,
        request,
      });
    } finally {
      await cleanup();
    }
  },
});
