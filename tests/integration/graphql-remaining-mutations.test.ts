import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import type { CloudflareR2Bucket } from "@/lib/adapters/cloudflare-runtime";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { prisma } from "@/lib/db/prisma";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../fixtures/dev-seed";
import { createMcpHarness, type McpHarness } from "./utils/mcp-harness";

const handler = createGraphqlRequestHandler(false);
const marker = `[integration-test] graphql-remaining-${Date.now()}`;
const oauthClientId = `graphql-remaining-${crypto.randomUUID()}`;
const oauthScopes = [
  restWriteScope("comment"),
  restWriteScope("dashboard"),
  restWriteScope("upload"),
];

type GraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
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

const bucket = new MemoryR2Bucket();
const allowMutation = { limit: async () => ({ success: true }) };
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for GraphQL integration tests");
}
const runtimeEnv = {
  APP_PUBLIC_ORIGIN: "http://localhost:3000",
  DATABASE_URL: databaseUrl,
  HYPERDRIVE: { connectionString: databaseUrl },
  NODE_ENV: "test",
  R2_UPLOADS: bucket,
  USER_BATCH_WRITE_RATE_LIMITER: allowMutation,
  USER_WRITE_RATE_LIMITER: allowMutation,
};
let mcp: McpHarness;
let userId = "";
let otherUserId = "";
let grantId = "";
let ownedCommentId = "";
let otherCommentId = "";
let mcpCommentId = "";
let completedUploadId = "";

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

async function execute(body: unknown, token: string) {
  const response = await runWithCloudflareRuntimeEnv(runtimeEnv, () =>
    handler(requestEvent(body, token)),
  );
  return {
    response,
    payload: (await response.json()) as GraphqlPayload,
  };
}

async function signToken(scopes: string[]) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await runWithCloudflareRuntimeEnv(runtimeEnv, () =>
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

beforeAll(async () => {
  const section = await prisma.section.findUniqueOrThrow({
    where: { jwId: DEV_SEED.section.jwId },
    select: { id: true },
  });
  const [user, otherUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${marker}-owner@example.test`,
        name: "GraphQL Remaining Owner",
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        email: `${marker}-other@example.test`,
        name: "GraphQL Remaining Other",
      },
      select: { id: true },
    }),
  ]);
  userId = user.id;
  otherUserId = otherUser.id;

  const oauthClient = await prisma.oAuthClient.create({
    data: {
      clientId: oauthClientId,
      consents: {
        create: {
          scopes: oauthScopes,
          userId,
        },
      },
      name: "GraphQL remaining mutations integration",
      redirectUris: ["https://graphql.example/callback"],
    },
    select: {
      consents: {
        select: { grantId: true },
      },
    },
  });
  grantId = oauthClient.consents[0]?.grantId ?? "";
  if (!grantId) throw new Error("Expected an OAuth consent fixture");

  const [ownedComment, otherComment, mcpComment] = await Promise.all([
    prisma.comment.create({
      data: {
        body: `${marker} owned`,
        sectionId: section.id,
        userId,
      },
      select: { id: true },
    }),
    prisma.comment.create({
      data: {
        body: `${marker} other`,
        sectionId: section.id,
        userId: otherUserId,
      },
      select: { id: true },
    }),
    prisma.comment.create({
      data: {
        body: `${marker} mcp`,
        sectionId: section.id,
        userId,
      },
      select: { id: true },
    }),
  ]);
  ownedCommentId = ownedComment.id;
  otherCommentId = otherComment.id;
  mcpCommentId = mcpComment.id;
  mcp = await createMcpHarness(userId);
});

afterAll(async () => {
  try {
    await mcp?.close();
  } finally {
    await prisma.auditLog.deleteMany({
      where: {
        targetId: {
          in: [
            ownedCommentId,
            mcpCommentId,
            ...(completedUploadId ? [completedUploadId] : []),
          ],
        },
      },
    });
    await prisma.comment.deleteMany({
      where: { id: { in: [ownedCommentId, otherCommentId, mcpCommentId] } },
    });
    await prisma.uploadPending.deleteMany({ where: { userId } });
    await prisma.upload.deleteMany({ where: { userId } });
    await prisma.dashboardLinkPin.deleteMany({ where: { userId } });
    await prisma.oAuthClient.deleteMany({ where: { clientId: oauthClientId } });
    await prisma.user.deleteMany({
      where: { id: { in: [userId, otherUserId] } },
    });
    await prisma.$disconnect();
  }
});

describe.sequential("remaining GraphQL and MCP mutation parity", () => {
  it("preserves dashboard ordering and comment per-item results over GraphQL", async () => {
    const token = await signToken([
      restWriteScope("dashboard"),
      restWriteScope("comment"),
    ]);
    const dashboard = await execute(
      {
        query: /* GraphQL */ `
          mutation DashboardBatch(
            $items: [DashboardLinkPinBatchItemInput!]!
          ) {
            setDashboardLinkPinStates(items: $items) {
              pinnedSlugs
              maxPinnedLinks
            }
          }
        `,
        variables: {
          items: [
            { slug: "mail", pinned: true },
            { slug: "mail", pinned: false },
          ],
        },
      },
      token,
    );
    expect(dashboard.payload.errors).toBeUndefined();
    expect(dashboard.payload.data?.setDashboardLinkPinStates).toEqual({
      pinnedSlugs: [],
      maxPinnedLinks: 4,
    });

    const comments = await execute(
      {
        query: /* GraphQL */ `
          mutation DeleteComments($ids: [ID!]!) {
            deleteComments(ids: $ids) {
              results {
                success
                id
                error {
                  code
                  message
                }
              }
            }
          }
        `,
        variables: { ids: [ownedCommentId, otherCommentId] },
      },
      token,
    );
    expect(comments.payload.errors).toBeUndefined();
    expect(comments.payload.data?.deleteComments).toEqual({
      results: [
        { success: true, id: ownedCommentId, error: null },
        {
          success: false,
          id: otherCommentId,
          error: { code: "FORBIDDEN", message: "Forbidden" },
        },
      ],
    });
  });

  it("runs the registered dashboard and comment batch operations", async () => {
    const dashboard = await mcp.call<{
      success: boolean;
      data: {
        setDashboardLinkPinStates: {
          pinnedSlugs: string[];
          maxPinnedLinks: number;
        };
      };
    }>("run_graphql_operation", {
      operationId: "dashboard.set_link_pin_states_batch.v1",
      variables: { items: [{ slug: "mail", pinned: true }] },
      confirmed: true,
      locale: "en-us",
    });
    expect(dashboard).toMatchObject({
      success: true,
      data: {
        setDashboardLinkPinStates: {
          pinnedSlugs: ["mail"],
          maxPinnedLinks: 4,
        },
      },
    });

    const comments = await mcp.call<{
      success: boolean;
      data: {
        deleteComments: {
          results: Array<{ success: boolean; id: string }>;
        };
      };
    }>("run_graphql_operation", {
      operationId: "comment.delete_batch.v1",
      variables: { ids: [mcpCommentId] },
      confirmed: true,
      locale: "en-us",
    });
    expect(comments).toMatchObject({
      success: true,
      data: {
        deleteComments: {
          results: [{ success: true, id: mcpCommentId }],
        },
      },
    });
  });

  it("exposes upload workflow metadata but keeps object bytes outside GraphQL and MCP", async () => {
    const created = await runWithCloudflareRuntimeEnv(runtimeEnv, () =>
      mcp.call<{
        success: boolean;
        data: {
          createUploadSession: {
            key: string;
            url: string;
            maxFileSizeBytes: number;
          };
        };
      }>("run_graphql_operation", {
        operationId: "upload.create_session.v1",
        variables: {
          input: {
            filename: `${marker}.txt`,
            contentType: "text/plain",
            size: 12,
          },
        },
        confirmed: true,
        locale: "en-us",
      }),
    );
    expect(created).toMatchObject({ success: true });
    const session = created.data.createUploadSession;
    expect(new URL(session.url).pathname).toBe("/api/uploads/object");
    expect(session.maxFileSizeBytes).toBeGreaterThan(12);

    // Simulate the separate authenticated HTTP PUT without sending bytes
    // through GraphQL or the MCP tool.
    bucket.objects.set(session.key, { contentType: "text/plain", size: 12 });

    const token = await signToken([restWriteScope("upload")]);
    const completed = await execute(
      {
        query: /* GraphQL */ `
          mutation CompleteUpload($input: CompleteUploadSessionInput!) {
            completeUploadSession(input: $input) {
              upload {
                id
                filename
                size
              }
              usedBytes
            }
          }
        `,
        variables: {
          input: {
            key: session.key,
            filename: `${marker}.txt`,
            contentType: "text/plain",
          },
        },
      },
      token,
    );
    expect(completed.payload.errors).toBeUndefined();
    const completion = completed.payload.data?.completeUploadSession as {
      upload: { id: string; filename: string; size: number };
      usedBytes: number;
    };
    completedUploadId = completion.upload.id;
    expect(completion).toMatchObject({
      upload: { filename: `${marker}.txt`, size: 12 },
      usedBytes: 12,
    });

    const renamed = await runWithCloudflareRuntimeEnv(runtimeEnv, () =>
      mcp.call<{
        success: boolean;
        data: { renameUpload: { upload: { filename: string } } };
      }>("run_graphql_operation", {
        operationId: "upload.rename.v1",
        variables: {
          id: completedUploadId,
          filename: `${marker}-renamed.txt`,
        },
        confirmed: true,
        locale: "en-us",
      }),
    );
    expect(renamed).toMatchObject({
      success: true,
      data: {
        renameUpload: {
          upload: { filename: `${marker}-renamed.txt` },
        },
      },
    });

    const deleted = await runWithCloudflareRuntimeEnv(runtimeEnv, () =>
      mcp.call<{
        success: boolean;
        data: {
          deleteUpload: {
            id: string;
            success: boolean;
            deletedSize: number;
          };
        };
      }>("run_graphql_operation", {
        operationId: "upload.delete.v1",
        variables: { id: completedUploadId },
        confirmed: true,
        locale: "en-us",
      }),
    );
    expect(deleted).toMatchObject({
      success: true,
      data: {
        deleteUpload: {
          id: completedUploadId,
          success: true,
          deletedSize: 12,
        },
      },
    });
    expect(bucket.deletedKeys).toContain(session.key);
    await expect(
      prisma.upload.findUnique({ where: { id: completedUploadId } }),
    ).resolves.toBeNull();
  });
});
