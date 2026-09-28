import type { RequestEvent } from "@sveltejs/kit";
import { test } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import {
  type CloudflareR2Bucket,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../fixtures/dev-seed";
import {
  createMcpHarness,
  type McpHarness,
} from "../integration/mcp/_harness/client";
import { createFixturePrisma, type TestPrismaClient } from "./prisma";

type GraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

class MemoryR2Bucket implements CloudflareR2Bucket {
  readonly objects = new Map<string, { contentType?: string; size: number }>();
  readonly deletedKeys: string[] = [];

  async delete(key: string) {
    this.deletedKeys.push(key);
    this.objects.delete(key);
  }

  async get() {
    return null;
  }

  async head(key: string) {
    const object = this.objects.get(key);
    return object
      ? {
          size: object.size,
          httpMetadata: { contentType: object.contentType },
        }
      : null;
  }

  async put(
    key: string,
    value:
      | ReadableStream<Uint8Array>
      | ArrayBuffer
      | ArrayBufferView
      | string
      | null,
    options?: { httpMetadata?: { contentType?: string } },
  ) {
    const size =
      typeof value === "string"
        ? new TextEncoder().encode(value).byteLength
        : value instanceof ArrayBuffer
          ? value.byteLength
          : ArrayBuffer.isView(value)
            ? value.byteLength
            : 0;
    this.objects.set(key, {
      contentType: options?.httpMetadata?.contentType,
      size,
    });
  }
}

function requestEvent(body: unknown, token: string): RequestEvent {
  return {
    request: new Request("https://life.example/api/graphql", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    locals: {
      authUser: null,
      locale: "en-us",
      requestId: "graphql-remaining-integration",
    },
  } as unknown as RequestEvent;
}

type GraphqlMutationState = {
  fixturePrisma: TestPrismaClient;
  bucket: MemoryR2Bucket;
  marker: string;
  userId: string;
  otherUserId: string;
  oauthClientId: string;
  grantId: string;
  ownedCommentId: string;
  otherCommentId: string;
  mcpCommentId: string;
  mcp: McpHarness;
  run<T>(work: () => T | Promise<T>): Promise<T>;
  execute(
    body: unknown,
    token: string,
  ): Promise<{ response: Response; payload: GraphqlPayload }>;
  signToken(scopes: string[]): Promise<string>;
};

export const graphqlMutationTest = test.extend<{
  graphql: GraphqlMutationState;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  graphql: async ({}, use) => {
    const db = createFixturePrisma();
    const nonce = crypto.randomUUID();
    const marker = `[integration-test] graphql-remaining-${nonce}`;
    const userId = `graphql-owner-${nonce}`;
    const otherUserId = `graphql-other-${nonce}`;
    const oauthClientId = `graphql-client-${nonce}`;
    const grantId = `graphql-grant-${nonce}`;
    const ownedCommentId = `graphql-comment-owner-${nonce}`;
    const otherCommentId = `graphql-comment-other-${nonce}`;
    const mcpCommentId = `graphql-comment-mcp-${nonce}`;
    const userIds = [userId, otherUserId];
    const commentIds = [ownedCommentId, otherCommentId, mcpCommentId];
    const bucket = new MemoryR2Bucket();
    const responses = new Set<Response>();
    const operations: Promise<void>[] = [];
    let mcp: McpHarness | undefined;
    const handler = createGraphqlRequestHandler(false);
    const app = process.env.DATABASE_URL;
    const auth = process.env.AUTH_DATABASE_URL;

    function run<T>(work: () => T | Promise<T>): Promise<T> {
      const tasks: Promise<PromiseSettledResult<unknown>>[] = [];
      const operation = runWithCloudflareRuntimeEnv(
        {
          APP_PUBLIC_ORIGIN: "http://localhost:3000",
          HYPERDRIVE: { connectionString: app },
          HYPERDRIVE_AUTH: { connectionString: auth },
          R2_UPLOADS: bucket,
          USER_BATCH_WRITE_RATE_LIMITER: {
            limit: async () => ({ success: true }),
          },
          USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
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
            failures.unshift(outcome.reason);
          }
          if (failures.length) {
            // Failed background work prevents the runtime from returning its
            // wrapped response; only then do we own the original body.
            if (
              outcome.status === "fulfilled" &&
              outcome.value instanceof Response
            )
              responses.add(outcome.value);
            throw new AggregateError(failures, "GraphQL mutation work failed");
          }
          if (outcome.status === "rejected") throw outcome.reason;
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
      operations.push(
        operation.then(
          () => undefined,
          () => undefined,
        ),
      );
      return operation;
    }

    async function execute(body: unknown, token: string) {
      const response = await run(() => handler(requestEvent(body, token)));
      return { response, payload: (await response.json()) as GraphqlPayload };
    }
    async function signToken(scopes: string[]) {
      const issuedAt = Math.floor(Date.now() / 1000);
      const token = await run(() =>
        signResourceBoundOAuthAccessToken({
          clientId: oauthClientId,
          expiresAt: issuedAt + 300,
          grantId,
          issuedAt,
          resources: [getOAuthGraphqlResourceUrl()],
          scopes,
          userId,
        }),
      );
      if (!token) throw new Error("Expected a signed GraphQL access token");
      return token;
    }

    async function cleanup() {
      for (let index = 0; index < operations.length; index++)
        await operations[index];
      const settled = await Promise.allSettled([
        ...(mcp ? [mcp.close()] : []),
        ...[...responses].map((response) =>
          response.body && !response.bodyUsed
            ? response.body.cancel()
            : undefined,
        ),
      ]);
      try {
        await db.$transaction(async (tx) => {
          await tx.auditLog.deleteMany({
            where: {
              OR: [
                { userId: { in: userIds } },
                { subjectUserId: { in: userIds } },
              ],
            },
          });
          await tx.featureOperationEvent.deleteMany({
            where: { userId: { in: userIds } },
          });
          await tx.comment.deleteMany({ where: { id: { in: commentIds } } });
          await tx.uploadPending.deleteMany({
            where: { userId: { in: userIds } },
          });
          await tx.upload.deleteMany({ where: { userId: { in: userIds } } });
          await tx.workspaceLinkPin.deleteMany({
            where: { userId: { in: userIds } },
          });
          await tx.oAuthClient.deleteMany({
            where: { clientId: oauthClientId },
          });
          await tx.user.deleteMany({ where: { id: { in: userIds } } });
          await tx.section.deleteMany({ where: { code: marker } });
        });
      } finally {
        bucket.objects.clear();
        bucket.deletedKeys.length = 0;
      }
      const failures = settled.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "GraphQL fixture cleanup failed");
    }

    try {
      if (!app || !auth)
        throw new Error(
          "GraphQL tests require restricted app and auth database URLs",
        );
      await db.$transaction(async (tx) => {
        const source = await tx.section.findUniqueOrThrow({
          where: { jwId: DEV_SEED.section.jwId },
          select: { courseId: true, semesterId: true },
        });
        const section = await tx.section.create({
          data: {
            ...source,
            code: marker,
            jwId: 1_800_000_000 + Math.floor(Math.random() * 100_000_000),
          },
        });
        await tx.user.createMany({
          data: [
            {
              id: userId,
              email: `${userId}@example.test`,
              name: "GraphQL Remaining Owner",
            },
            {
              id: otherUserId,
              email: `${otherUserId}@example.test`,
              name: "GraphQL Remaining Other",
            },
          ],
        });
        await tx.oAuthClient.create({
          data: {
            clientId: oauthClientId,
            consents: {
              create: {
                grantId,
                userId,
                scopes: [
                  restWriteScope("community.comment"),
                  restWriteScope("workspace.link-pin"),
                  restWriteScope("workspace.upload"),
                ],
              },
            },
            name: "GraphQL remaining mutations integration",
            redirectUris: ["https://graphql.example/callback"],
          },
        });
        await tx.comment.createMany({
          data: [
            {
              id: ownedCommentId,
              body: `${marker} owned`,
              sectionId: section.id,
              userId,
            },
            {
              id: otherCommentId,
              body: `${marker} other`,
              sectionId: section.id,
              userId: otherUserId,
            },
            {
              id: mcpCommentId,
              body: `${marker} mcp`,
              sectionId: section.id,
              userId,
            },
          ],
        });
      });
      mcp = await run(() => createMcpHarness(userId));
      await use({
        fixturePrisma: db,
        bucket,
        marker,
        userId,
        otherUserId,
        oauthClientId,
        grantId,
        ownedCommentId,
        otherCommentId,
        mcpCommentId,
        mcp,
        run,
        execute,
        signToken,
      });
    } finally {
      try {
        await cleanup();
      } finally {
        await db.$disconnect();
      }
    }
  },
});
