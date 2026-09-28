import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteHomeworkForModeration } from "@/features/homeworks/server/homework-mutations";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import { createFixturePrisma } from "../shared/prisma";

const fixturePrisma = createFixturePrisma();

const handler = createGraphqlRequestHandler(false);
let marker = "";
let oauthClientId = "";
let section: { id: number; jwId: number } | undefined;

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
  const consent = await fixturePrisma.oAuthConsent.findFirstOrThrow({
    where: {
      clientId: oauthClientId,
      scopes: { hasEvery: scopes },
      userId,
    },
    select: { grantId: true },
  });
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signResourceBoundOAuthAccessToken({
    clientId: oauthClientId,
    grantId: consent.grantId,
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

beforeEach(async () => {
  marker = `[integration-test] graphql-homework-${crypto.randomUUID()}`;
  oauthClientId = `graphql-homework-${crypto.randomUUID()}`;
  creatorId = crypto.randomUUID();
  collaboratorId = crypto.randomUUID();
  section = undefined;
  await fixturePrisma.user.createMany({
    data: [
      {
        id: creatorId,
        email: `${creatorId}@graphql-homework.test`,
        name: "GraphQL Homework Creator",
      },
      {
        id: collaboratorId,
        email: `${collaboratorId}@graphql-homework.test`,
        name: "GraphQL Homework Collaborator",
      },
    ],
  });
  const source = await fixturePrisma.section.findFirstOrThrow({
    where: { retiredAt: null },
    select: { courseId: true, semesterId: true },
  });
  section = await fixturePrisma.section.create({
    data: {
      ...source,
      jwId: 1_800_000_000 + Math.floor(Math.random() * 100_000_000),
      code: marker,
    },
    select: { id: true, jwId: true },
  });
  await fixturePrisma.oAuthClient.create({
    data: {
      clientId: oauthClientId,
      consents: {
        create: [
          {
            scopes: [
              restReadScope("community.section-homework"),
              restWriteScope("community.section-homework"),
              restWriteScope("workspace.homework"),
            ],
            userId: creatorId,
          },
          {
            scopes: [
              restReadScope("community.section-homework"),
              restWriteScope("community.section-homework"),
              restWriteScope("workspace.homework"),
            ],
            userId: collaboratorId,
          },
        ],
      },
      name: "GraphQL homework integration",
      redirectUris: ["https://graphql.example/callback"],
    },
  });
});

afterEach(async () => {
  await fixturePrisma.oAuthClient.deleteMany({
    where: { clientId: oauthClientId },
  });
  await fixturePrisma.auditLog.deleteMany({
    where: { userId: { in: [creatorId, collaboratorId] } },
  });
  if (section)
    await fixturePrisma.section.deleteMany({ where: { id: section.id } });
  await fixturePrisma.userSuspension.deleteMany({
    where: { userId: { in: [creatorId, collaboratorId] } },
  });
  await fixturePrisma.user.deleteMany({
    where: { id: { in: [creatorId, collaboratorId] } },
  });
});

afterAll(async () => {
  await Promise.all([
    fixturePrisma.$disconnect(),
    authPrisma.$disconnect(),
    runtimePrisma.$disconnect(),
  ]);
});

function ownSection() {
  if (!section) throw new Error("Missing isolated section");
  return section;
}

async function arrangeHomework() {
  return fixturePrisma.homework.create({
    data: {
      sectionId: ownSection().id,
      title: `${marker} initial`,
      createdById: creatorId,
      isMajor: true,
      requiresTeam: true,
      publishedAt: new Date("2026-07-20T00:00:00Z"),
      submissionStartAt: new Date("2026-07-21T00:00:00Z"),
      submissionDueAt: new Date("2026-07-22T10:00:00Z"),
      description: {
        create: { content: "Solve question 1", lastEditedById: creatorId },
      },
    },
  });
}

describe("GraphQL homework CRUD mutations", () => {
  it.each([
    { name: "non-admin creator", administrator: false, allowed: false },
    { name: "administrator", administrator: true, allowed: true },
  ])("explicit moderation by $name", async ({ administrator, allowed }) => {
    const homework = await arrangeHomework();
    const userId = administrator ? collaboratorId : creatorId;
    if (administrator)
      await fixturePrisma.user.update({
        where: { id: userId },
        data: { isAdmin: true },
      });
    const result = await deleteHomeworkForModeration({
      userId,
      homeworkId: homework.id,
      audit: { channel: "web" },
    });
    expect(result).toMatchObject(
      allowed
        ? { ok: true, alreadyDeleted: false }
        : { ok: false, error: "forbidden" },
    );
    expect(
      await fixturePrisma.homework.findUniqueOrThrow({
        where: { id: homework.id },
        select: { deletedAt: true, deletedById: true },
      }),
    ).toEqual(
      allowed
        ? { deletedAt: expect.any(Date), deletedById: userId }
        : { deletedAt: null, deletedById: null },
    );
    const audits = await fixturePrisma.auditLog.findMany({
      where: { targetId: homework.id },
      select: { action: true, userId: true },
    });
    expect(audits).toEqual(
      allowed ? [{ action: "homework_delete", userId }] : [],
    );
  });

  it("requires the exact homework write scope before resolving a section", async () => {
    const readToken = await signToken(creatorId, [
      restReadScope("community.section-homework"),
    ]);
    const result = await execute(
      {
        query: /* GraphQL */ `
          mutation CreateWithoutWriteScope($sectionJwId: Int!) {
            homeworkCreate(
              input: {
                sectionJwId: $sectionJwId
                title: "${marker} missing scope"
              }
            ) {
              id
            }
          }
        `,
        variables: { sectionJwId: ownSection().jwId },
      },
      readToken,
    );

    expectErrorCode(result.payload, "FORBIDDEN");
    expect(result.payload.errors?.[0]?.extensions?.requiredScopes).toEqual([
      "community.section-homework:write",
    ]);
    await expect(
      fixturePrisma.homework.count({
        where: { title: `${marker} missing scope` },
      }),
    ).resolves.toBe(0);
  });

  it("validates the shared homework submission window before writing", async () => {
    const token = await signToken(creatorId, [
      restWriteScope("community.section-homework"),
    ]);
    const result = await execute(
      {
        query: /* GraphQL */ `
          mutation InvalidHomeworkWindow(
            $sectionJwId: Int!
            $start: DateTime!
            $due: DateTime!
          ) {
            homeworkCreate(
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
          sectionJwId: ownSection().jwId,
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
      fixturePrisma.homework.count({
        where: { title: `${marker} invalid window` },
      }),
    ).resolves.toBe(0);
  });

  it("creates homework and records the normalized state and creation audit", async () => {
    const creatorToken = await signToken(creatorId, [
      restWriteScope("community.section-homework"),
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
            homeworkCreate(
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
          sectionJwId: ownSection().jwId,
          publishedAt: "2026-07-20T08:00:00+08:00",
          start: "2026-07-21T08:00:00+08:00",
          due: "2026-07-22T18:00:00+08:00",
        },
      },
      creatorToken,
    );
    expect(created.response.headers.get("cache-control")).toBe("no-store");
    expect(
      created.payload.errors,
      JSON.stringify(created.payload),
    ).toBeUndefined();
    const createPayload = created.payload.data?.homeworkCreate as
      | {
          id: string;
          homework: Record<string, unknown>;
        }
      | undefined;
    expect(createPayload?.id).toEqual(expect.any(String));
    const homeworkId = createPayload?.id as string;
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
      section: { jwId: ownSection().jwId },
    });

    const createdRecord = await fixturePrisma.homework.findUniqueOrThrow({
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
      fixturePrisma.auditLog.findMany({
        where: { action: "homework_create", targetId: homeworkId },
        select: { action: true, userId: true, metadata: true },
      }),
    ).resolves.toEqual([
      {
        action: "homework_create",
        userId: creatorId,
        metadata: expect.objectContaining({ sectionId: expect.any(Number) }),
      },
    ]);
  });

  it("collaboratively updates known homework and records description audit", async () => {
    const { id: homeworkId } = await arrangeHomework();
    const collaboratorToken = await signToken(collaboratorId, [
      restWriteScope("community.section-homework"),
    ]);
    const updated = await execute(
      {
        query: /* GraphQL */ `
          mutation UpdateHomework($id: ID!, $due: DateTime!) {
            homeworkUpdate(
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
        homeworkUpdate: {
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
    const updatedRecord = await fixturePrisma.homework.findUniqueOrThrow({
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
      fixturePrisma.auditLog.findFirstOrThrow({
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
  });

  it.each([false, true])(
    "rejects deletion by another owner even when isAdmin=%s",
    async (isAdmin) => {
      const { id: homeworkId } = await arrangeHomework();
      await fixturePrisma.user.update({
        where: { id: collaboratorId },
        data: { isAdmin },
      });
      const token = await signToken(collaboratorId, [
        restWriteScope("community.section-homework"),
      ]);
      const before = await fixturePrisma.homework.findUniqueOrThrow({
        where: { id: homeworkId },
      });
      const { payload } = await execute(
        {
          query:
            "mutation DeleteOtherHomework($id: ID!) { homeworkDelete(id: $id) { success } }",
          variables: { id: homeworkId },
        },
        token,
      );
      expectErrorCode(payload, "FORBIDDEN");
      expect(
        await fixturePrisma.homework.findUniqueOrThrow({
          where: { id: homeworkId },
        }),
      ).toEqual(before);
      expect(
        await fixturePrisma.auditLog.findMany({
          where: { userId: collaboratorId },
        }),
      ).toEqual([]);
    },
  );

  it("creator deletion is idempotent and emits one deletion audit", async () => {
    const { id: homeworkId } = await arrangeHomework();
    const creatorToken = await signToken(creatorId, [
      restWriteScope("community.section-homework"),
    ]);
    const deleted = await execute(
      {
        query: /* GraphQL */ `
          mutation DeleteHomework($id: ID!) {
            homeworkDelete(id: $id) {
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
        homeworkDelete: {
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
            homeworkDelete(id: $id) {
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
        homeworkDelete: {
          id: homeworkId,
          success: true,
          alreadyDeleted: true,
        },
      },
    });
    expect(
      await fixturePrisma.homework.findUniqueOrThrow({
        where: { id: homeworkId },
        select: { deletedAt: true, deletedById: true },
      }),
    ).toEqual({ deletedAt: expect.any(Date), deletedById: creatorId });
    expect(
      await fixturePrisma.auditLog.findMany({
        where: { targetId: homeworkId },
        select: { action: true, userId: true, metadata: true },
      }),
    ).toEqual([
      {
        action: "homework_delete",
        userId: creatorId,
        metadata: expect.objectContaining({ sectionId: ownSection().id }),
      },
    ]);
  });
});

describe("GraphQL completion batch boundaries", () => {
  const items = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      homeworkId: `missing-homework-${index}`,
      completed: true,
    }));
  const send = async (value: ReturnType<typeof items>) =>
    execute(
      {
        query:
          "mutation CompletionBatch($items: [HomeworkCompletionBatchItemInput!]!) { homeworkCompletionsSet(items: $items) { results { success homeworkId } } }",
        variables: { items: value },
      },
      await signToken(creatorId, [restWriteScope("workspace.homework")]),
    );

  it.each([1, 100])(
    "accepts %s items and persists every completion",
    async (size) => {
      const homeworkIds = Array.from({ length: size }, () =>
        crypto.randomUUID(),
      );
      await fixturePrisma.homework.createMany({
        data: homeworkIds.map((id) => ({
          id,
          sectionId: ownSection().id,
          title: `${marker} batch`,
        })),
      });
      const value = homeworkIds.map((homeworkId) => ({
        homeworkId,
        completed: true,
      }));
      const { response, payload } = await send(value);
      expect(response.status).toBe(200);
      expect(payload.errors).toBeUndefined();
      expect(payload.data?.homeworkCompletionsSet).toEqual({
        results: homeworkIds.map((homeworkId) => ({
          success: true,
          homeworkId,
        })),
      });
      expect(
        await fixturePrisma.homeworkCompletion.findMany({
          where: { homeworkId: { in: homeworkIds } },
          select: { userId: true, homeworkId: true, completedAt: true },
          orderBy: { homeworkId: "asc" },
        }),
      ).toEqual(
        [...homeworkIds].sort().map((homeworkId) => ({
          userId: creatorId,
          homeworkId,
          completedAt: expect.any(Date),
        })),
      );
    },
  );

  it("returns an independent not-found result for each missing target", async () => {
    const { payload } = await send(items(2));
    expect(payload.errors).toBeUndefined();
    expect(payload.data?.homeworkCompletionsSet).toEqual({
      results: items(2).map(({ homeworkId }) => ({
        success: false,
        homeworkId,
      })),
    });
    expect(
      await fixturePrisma.homeworkCompletion.findMany({
        where: { userId: creatorId },
      }),
    ).toEqual([]);
  });

  it.each([
    { name: "empty", count: 0 },
    { name: "over 100", count: 101 },
    { name: "duplicate", count: 2 },
    { name: "normalized duplicate", count: 2 },
  ])(
    "rejects $name batches without changing existing completion",
    async ({ name, count }) => {
      const homework = await arrangeHomework();
      const completedAt = new Date("2026-09-13T08:00:00Z");
      await fixturePrisma.homeworkCompletion.create({
        data: { userId: creatorId, homeworkId: homework.id, completedAt },
      });
      const value = name.includes("duplicate")
        ? [
            { homeworkId: homework.id, completed: false },
            {
              homeworkId:
                name === "normalized duplicate"
                  ? ` ${homework.id} `
                  : homework.id,
              completed: true,
            },
          ]
        : items(count).map((item, index) =>
            index === 0 ? { homeworkId: homework.id, completed: false } : item,
          );
      expectErrorCode((await send(value)).payload, "BAD_USER_INPUT");
      expect(
        await fixturePrisma.homeworkCompletion.findMany({
          where: { userId: creatorId },
          select: { homeworkId: true, completedAt: true },
        }),
      ).toEqual([{ homeworkId: homework.id, completedAt }]);
      expect(
        await fixturePrisma.auditLog.findMany({ where: { userId: creatorId } }),
      ).toEqual([]);
    },
  );
});
