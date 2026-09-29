import type { RequestEvent } from "@sveltejs/kit";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import type { CloudflareR2Bucket } from "@/lib/adapters/cloudflare-runtime";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import {
  type McpHarness,
  ownMcpHarness,
} from "../integration/mcp/_harness/client";
import { nodeProtocolTest } from "./node-protocol-fixture";
import type { TestPrismaClient } from "./prisma";

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

// Installed Better Auth caches are process-owned: each consumer of this fixture
// has one native Vitest case per file, as in the other OAuth protocol contracts.
export const graphqlMutationTest = nodeProtocolTest.extend<{
  protocolBindings: Record<string, unknown>;
  mutationBucket: MemoryR2Bucket;
  mutationMcp: { userId: string; owned: ReturnType<typeof ownMcpHarness> };
  graphql: GraphqlMutationState;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  mutationBucket: async ({}, use) => {
    const bucket = new MemoryR2Bucket();
    try {
      await use(bucket);
    } finally {
      bucket.objects.clear();
      bucket.deletedKeys.length = 0;
    }
  },
  protocolBindings: async ({ mutationBucket }, use) => {
    await use({ R2_UPLOADS: mutationBucket });
  },
  mutationMcp: async ({ protocolRuntime }, use) => {
    const userId = `graphql-owner-${crypto.randomUUID()}`;
    const owned = ownMcpHarness(userId, undefined, {
      run: protocolRuntime.request,
    });
    const failures: unknown[] = [];
    try {
      // Register transport ownership before dependent setup initializes it.
      await use({ userId, owned });
    } catch (error) {
      failures.push(error);
    } finally {
      // Closing the SDK transport rejects pending initialization/client calls;
      // its owner also waits for real server handlers and their background work.
      const results = await Promise.allSettled([owned.client.close()]);
      results.push(...(await Promise.allSettled([protocolRuntime.drain()])));
      failures.push(
        ...results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        ),
      );
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length)
      throw new AggregateError(failures, "GraphQL MCP lifecycle failed");
  },
  graphql: async (
    {
      isolatedDatabase: { owner: db },
      protocolRuntime,
      mutationBucket: bucket,
      mutationMcp: { userId, owned },
    },
    use,
  ) => {
    const nonce = crypto.randomUUID();
    const marker = `[integration-test] graphql-remaining-${nonce}`;
    const otherUserId = `graphql-other-${nonce}`;
    const oauthClientId = `graphql-client-${nonce}`;
    const grantId = `graphql-grant-${nonce}`;
    const ownedCommentId = `graphql-comment-owner-${nonce}`;
    const otherCommentId = `graphql-comment-other-${nonce}`;
    const mcpCommentId = `graphql-comment-mcp-${nonce}`;
    const handler = createGraphqlRequestHandler(false);
    const run = protocolRuntime.request;

    async function execute(body: unknown, token: string) {
      return protocolRuntime.request(async () => {
        const response = await handler(requestEvent(body, token));
        return { response, payload: (await response.json()) as GraphqlPayload };
      });
    }
    async function signToken(scopes: string[]) {
      return protocolRuntime.request(async () => {
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await signResourceBoundOAuthAccessToken({
          clientId: oauthClientId,
          expiresAt: issuedAt + 300,
          grantId,
          issuedAt,
          resources: [getOAuthGraphqlResourceUrl()],
          scopes,
          userId,
        });
        if (!token) throw new Error("Expected a signed GraphQL access token");
        return token;
      });
    }

    await protocolRuntime.run(async () => {
      await db.$transaction(async (tx) => {
        const semester = await tx.semester.create({
          data: {
            jwId: 1,
            code: "graphql-mutations",
            nameCn: "GraphQL semester",
          },
        });
        const course = await tx.course.create({
          data: {
            jwId: 1,
            code: "graphql-mutations",
            nameCn: "GraphQL course",
          },
        });
        const section = await tx.section.create({
          data: {
            courseId: course.id,
            semesterId: semester.id,
            code: marker,
            jwId: 1,
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
      await owned.initialize();
    });
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
      mcp: owned.client,
      run,
      execute,
      signToken,
    });
  },
});
