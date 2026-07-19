import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { prisma } from "@/lib/db/prisma";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../fixtures/dev-seed";

const handler = createGraphqlRequestHandler(false);
const marker = `[integration-test] graphql-homework-${Date.now()}`;
const createdHomeworkIds: string[] = [];

let creatorId = "";
let collaboratorId = "";

type GraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
};

function requestEvent(body: unknown, token?: string): RequestEvent {
  return {
    request: new Request("https://life.example/api/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
    locals: {
      authUser: null,
      locale: "en-us",
      requestId: "graphql-homework-mutations-integration",
    },
  } as unknown as RequestEvent;
}

async function execute(body: unknown, token?: string) {
  const response = await handler(requestEvent(body, token));
  return {
    response,
    payload: (await response.json()) as GraphqlPayload,
  };
}

async function signToken(userId: string, scopes: string[]) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signResourceBoundOAuthAccessToken({
    clientId: "graphql-homework-mutations-integration",
    expiresAt: issuedAt + 300,
    issuedAt,
    resources: [getOAuthGraphqlResourceUrl()],
    scopes,
    userId,
  });
  if (!token) throw new Error("Expected a signed GraphQL access token");
  return token;
}

function expectErrorCode(payload: GraphqlPayload, code: string) {
  expect(payload.data).toBeNull();
  expect(payload.errors?.[0]?.extensions?.code).toBe(code);
}

beforeAll(async () => {
  const [creator, collaborator] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${marker}-creator@example.test`,
        name: "GraphQL Homework Creator",
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        email: `${marker}-collaborator@example.test`,
        name: "GraphQL Homework Collaborator",
      },
      select: { id: true },
    }),
  ]);
  creatorId = creator.id;
  collaboratorId = collaborator.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { userId: { in: [creatorId, collaboratorId] } },
  });
  await prisma.homeworkAuditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: [creatorId, collaboratorId] } },
        { homeworkId: { in: createdHomeworkIds } },
      ],
    },
  });
  await prisma.homework.deleteMany({
    where: { id: { in: createdHomeworkIds } },
  });
  await prisma.userSuspension.deleteMany({
    where: { userId: { in: [creatorId, collaboratorId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [creatorId, collaboratorId] } },
  });
  await prisma.$disconnect();
});

describe("GraphQL homework CRUD mutations", () => {
  it("requires the exact homework write scope before resolving a section", async () => {
    const readToken = await signToken(creatorId, [restReadScope("homework")]);
    const result = await execute(
      {
        query: /* GraphQL */ `
          mutation CreateWithoutWriteScope($sectionJwId: Int!) {
            createHomework(
              input: {
                sectionJwId: $sectionJwId
                title: "${marker} missing scope"
              }
            ) {
              id
            }
          }
        `,
        variables: { sectionJwId: DEV_SEED.section.jwId },
      },
      readToken,
    );

    expectErrorCode(result.payload, "FORBIDDEN");
    expect(result.payload.errors?.[0]?.extensions?.requiredScopes).toEqual([
      "homework:write",
    ]);
    await expect(
      prisma.homework.count({
        where: { title: `${marker} missing scope` },
      }),
    ).resolves.toBe(0);
  });

  it("validates the shared homework submission window before writing", async () => {
    const token = await signToken(creatorId, [restWriteScope("homework")]);
    const result = await execute(
      {
        query: /* GraphQL */ `
          mutation InvalidHomeworkWindow(
            $sectionJwId: Int!
            $start: DateTime!
            $due: DateTime!
          ) {
            createHomework(
              input: {
                sectionJwId: $sectionJwId
                title: "${marker} invalid window"
                submissionStartAt: $start
                submissionDueAt: $due
              }
            ) {
              id
            }
          }
        `,
        variables: {
          sectionJwId: DEV_SEED.section.jwId,
          start: "2026-08-02T08:00:00+08:00",
          due: "2026-08-01T18:00:00+08:00",
        },
      },
      token,
    );

    expectErrorCode(result.payload, "BAD_USER_INPUT");
    expect(result.payload.errors?.[0]?.message).toBe(
      "Submission start must be before due",
    );
    await expect(
      prisma.homework.count({
        where: { title: `${marker} invalid window` },
      }),
    ).resolves.toBe(0);
  });

  it("creates, collaboratively updates, and creator-deletes with shared audit semantics", async () => {
    const [creatorToken, collaboratorToken] = await Promise.all([
      signToken(creatorId, [restWriteScope("homework")]),
      signToken(collaboratorId, [restWriteScope("homework")]),
    ]);
    const created = await execute(
      {
        query: /* GraphQL */ `
          mutation CreateHomework(
            $sectionJwId: Int!
            $publishedAt: DateTime!
            $start: DateTime!
            $due: DateTime!
          ) {
            createHomework(
              input: {
                sectionJwId: $sectionJwId
                title: "  ${marker} initial  "
                description: "  Solve question 1  "
                isMajor: true
                requiresTeam: true
                publishedAt: $publishedAt
                submissionStartAt: $start
                submissionDueAt: $due
              }
            ) {
              id
              homework {
                id
                title
                isMajor
                requiresTeam
                publishedAt
                submissionStartAt
                submissionDueAt
                completed
                commentCount
                section {
                  jwId
                }
              }
            }
          }
        `,
        variables: {
          sectionJwId: DEV_SEED.section.jwId,
          publishedAt: "2026-07-20T08:00:00+08:00",
          start: "2026-07-21T08:00:00+08:00",
          due: "2026-07-22T18:00:00+08:00",
        },
      },
      creatorToken,
    );
    expect(created.response.headers.get("cache-control")).toBe("no-store");
    expect(created.payload.errors).toBeUndefined();
    const createPayload = created.payload.data?.createHomework as
      | {
          id: string;
          homework: Record<string, unknown>;
        }
      | undefined;
    expect(createPayload?.id).toEqual(expect.any(String));
    const homeworkId = createPayload?.id as string;
    createdHomeworkIds.push(homeworkId);
    expect(createPayload?.homework).toMatchObject({
      id: homeworkId,
      title: `${marker} initial`,
      isMajor: true,
      requiresTeam: true,
      publishedAt: "2026-07-20T00:00:00.000Z",
      submissionStartAt: "2026-07-21T00:00:00.000Z",
      submissionDueAt: "2026-07-22T10:00:00.000Z",
      completed: false,
      commentCount: 0,
      section: { jwId: DEV_SEED.section.jwId },
    });

    const createdRecord = await prisma.homework.findUniqueOrThrow({
      where: { id: homeworkId },
      select: {
        createdById: true,
        description: { select: { content: true } },
        isMajor: true,
        requiresTeam: true,
        title: true,
      },
    });
    expect(createdRecord).toEqual({
      createdById: creatorId,
      description: { content: "Solve question 1" },
      isMajor: true,
      requiresTeam: true,
      title: `${marker} initial`,
    });
    await expect(
      prisma.homeworkAuditLog.findMany({
        where: { homeworkId },
        select: { action: true, actorId: true, titleSnapshot: true },
      }),
    ).resolves.toEqual([
      {
        action: "created",
        actorId: creatorId,
        titleSnapshot: `${marker} initial`,
      },
    ]);

    const updated = await execute(
      {
        query: /* GraphQL */ `
          mutation UpdateHomework($id: ID!, $due: DateTime!) {
            updateHomework(
              id: $id
              input: {
                title: "  ${marker} updated  "
                description: null
                isMajor: false
                requiresTeam: false
                publishedAt: null
                submissionStartAt: null
                submissionDueAt: $due
              }
            ) {
              id
              homework {
                id
                title
                isMajor
                requiresTeam
                publishedAt
                submissionStartAt
                submissionDueAt
              }
            }
          }
        `,
        variables: {
          id: homeworkId,
          due: "2026-07-23T18:00:00+08:00",
        },
      },
      collaboratorToken,
    );
    expect(updated.payload).toEqual({
      data: {
        updateHomework: {
          id: homeworkId,
          homework: {
            id: homeworkId,
            title: `${marker} updated`,
            isMajor: false,
            requiresTeam: false,
            publishedAt: null,
            submissionStartAt: null,
            submissionDueAt: "2026-07-23T10:00:00.000Z",
          },
        },
      },
    });
    const updatedRecord = await prisma.homework.findUniqueOrThrow({
      where: { id: homeworkId },
      select: {
        description: { select: { content: true, id: true } },
        updatedById: true,
      },
    });
    expect(updatedRecord).toMatchObject({
      description: { content: "" },
      updatedById: collaboratorId,
    });
    await expect(
      prisma.auditLog.findFirstOrThrow({
        where: {
          action: "description_edit",
          targetId: updatedRecord.description?.id,
          userId: collaboratorId,
        },
        select: { metadata: true },
      }),
    ).resolves.toMatchObject({
      metadata: { targetType: "homework" },
    });

    const forbiddenDelete = await execute(
      {
        query:
          "mutation DeleteOtherHomework($id: ID!) { deleteHomework(id: $id) { success } }",
        variables: { id: homeworkId },
      },
      collaboratorToken,
    );
    expectErrorCode(forbiddenDelete.payload, "FORBIDDEN");

    const deleted = await execute(
      {
        query: /* GraphQL */ `
          mutation DeleteHomework($id: ID!) {
            deleteHomework(id: $id) {
              id
              success
              alreadyDeleted
            }
          }
        `,
        variables: { id: homeworkId },
      },
      creatorToken,
    );
    expect(deleted.payload).toEqual({
      data: {
        deleteHomework: {
          id: homeworkId,
          success: true,
          alreadyDeleted: false,
        },
      },
    });

    const repeatedDelete = await execute(
      {
        query: /* GraphQL */ `
          mutation DeleteHomeworkAgain($id: ID!) {
            deleteHomework(id: $id) {
              id
              success
              alreadyDeleted
            }
          }
        `,
        variables: { id: homeworkId },
      },
      creatorToken,
    );
    expect(repeatedDelete.payload).toEqual({
      data: {
        deleteHomework: {
          id: homeworkId,
          success: true,
          alreadyDeleted: true,
        },
      },
    });
    await expect(
      prisma.homeworkAuditLog.findMany({
        where: { homeworkId },
        orderBy: [{ createdAt: "asc" }, { action: "asc" }],
        select: { action: true, actorId: true, titleSnapshot: true },
      }),
    ).resolves.toEqual([
      {
        action: "created",
        actorId: creatorId,
        titleSnapshot: `${marker} initial`,
      },
      {
        action: "deleted",
        actorId: creatorId,
        titleSnapshot: `${marker} updated`,
      },
    ]);
  });
});
