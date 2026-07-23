import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { USTC_DASHBOARD_LINKS } from "@/features/dashboard-links/lib/dashboard-links";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { prisma } from "@/lib/db/prisma";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../fixtures/dev-seed";

const handler = createGraphqlRequestHandler(false);
const marker = `[integration-test] graphql-mutations-${Date.now()}`;
const oauthClientId = `graphql-mutations-${crypto.randomUUID()}`;
const createdCommentIds: string[] = [];
const mutationScopes = [
  restReadScope("todo"),
  restWriteScope("bus"),
  restWriteScope("comment"),
  restWriteScope("dashboard"),
  restWriteScope("homework"),
  restWriteScope("subscription"),
  restWriteScope("todo"),
];

let userAId = "";
let userBId = "";
let homeworkId = "";
let originCampusId = 0;
let destinationCampusId = 0;

type GraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
};

function requestEvent(
  body: unknown,
  token?: string,
  extraHeaders: Record<string, string> = {},
): RequestEvent {
  return {
    request: new Request("https://life.example/api/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    }),
    locals: {
      authUser: null,
      locale: "zh-cn",
      requestId: "graphql-mutations-integration",
    },
  } as unknown as RequestEvent;
}

async function execute(
  body: unknown,
  token?: string,
  extraHeaders?: Record<string, string>,
) {
  const response = await handler(requestEvent(body, token, extraHeaders));
  return {
    response,
    payload: (await response.json()) as GraphqlPayload,
  };
}

async function signToken(userId: string, scopes: string[]) {
  const consent = await prisma.oAuthConsent.findFirstOrThrow({
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

beforeAll(async () => {
  const [userA, userB, homework, campuses] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${marker}-a@example.test`,
        name: "GraphQL Mutation A",
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        email: `${marker}-b@example.test`,
        name: "GraphQL Mutation B",
      },
      select: { id: true },
    }),
    prisma.homework.findFirstOrThrow({
      where: { deletedAt: null },
      select: { id: true },
    }),
    prisma.busCampus.findMany({
      orderBy: { id: "asc" },
      take: 2,
      select: { id: true },
    }),
  ]);
  if (campuses.length < 2) {
    throw new Error("GraphQL mutation integration requires two bus campuses");
  }

  userAId = userA.id;
  userBId = userB.id;
  homeworkId = homework.id;
  originCampusId = campuses[0].id;
  destinationCampusId = campuses[1].id;

  await prisma.oAuthClient.create({
    data: {
      clientId: oauthClientId,
      consents: {
        create: [
          { scopes: mutationScopes, userId: userAId },
          { scopes: mutationScopes, userId: userBId },
        ],
      },
      name: "GraphQL mutations integration",
      redirectUris: ["https://graphql.example/callback"],
    },
  });
});

afterAll(async () => {
  await prisma.oAuthClient.deleteMany({ where: { clientId: oauthClientId } });
  await prisma.auditLog.deleteMany({
    where: { targetId: { in: createdCommentIds } },
  });
  await prisma.comment.deleteMany({
    where: { id: { in: createdCommentIds } },
  });
  await prisma.userSuspension.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userAId, userBId] } },
  });
  await prisma.$disconnect();
});

describe("GraphQL authenticated mutations", () => {
  it("rejects anonymous and insufficient-scope writes before service execution", async () => {
    const anonymous = await execute({
      query: 'mutation { todoCreate(input: { title: "anonymous" }) { id } }',
    });
    expect(anonymous.response.headers.get("cache-control")).toBe("no-store");
    expectErrorCode(anonymous.payload, "UNAUTHENTICATED");

    const readToken = await signToken(userAId, [restReadScope("todo")]);
    const missingScope = await execute(
      {
        query: 'mutation { todoCreate(input: { title: "read only" }) { id } }',
      },
      readToken,
    );
    expectErrorCode(missingScope.payload, "FORBIDDEN");
    expect(
      missingScope.payload.errors?.[0]?.extensions?.requiredScopes,
    ).toEqual(["todo:write"]);

    await expect(
      prisma.todo.count({
        where: { userId: userAId, title: { in: ["anonymous", "read only"] } },
      }),
    ).resolves.toBe(0);
  });

  it("supports bearer todo CRUD while preserving owner isolation and null updates", async () => {
    const [tokenA, tokenB] = await Promise.all([
      signToken(userAId, [restReadScope("todo"), restWriteScope("todo")]),
      signToken(userBId, [restWriteScope("todo")]),
    ]);
    const created = await execute(
      {
        query: /* GraphQL */ `
          mutation CreateTodo($dueAt: DateTime!) {
            todoCreate(
              input: {
                title: "  ${marker} todo  "
                content: "  initial  "
                priority: HIGH
                dueAt: $dueAt
              }
            ) {
              id
            }
          }
        `,
        variables: { dueAt: "2026-08-01T09:00:00+08:00" },
      },
      tokenA,
    );
    expect(created.response.headers.get("cache-control")).toBe("no-store");
    expect(created.payload.errors).toBeUndefined();
    const todoId = (
      created.payload.data?.todoCreate as { id?: string } | undefined
    )?.id;
    expect(todoId).toEqual(expect.any(String));

    await expect(
      prisma.todo.findUniqueOrThrow({
        where: { id: todoId },
        select: { content: true, dueAt: true, priority: true, title: true },
      }),
    ).resolves.toMatchObject({
      content: "initial",
      dueAt: new Date("2026-08-01T01:00:00.000Z"),
      priority: "high",
      title: `${marker} todo`,
    });

    const roundTrip = await execute(
      {
        query: /* GraphQL */ `
          query TodoPriorityRoundTrip {
            viewer: workspace {
              todos(filter: { priority: HIGH }, page: { pageSize: 100 }) {
                items {
                  id
                  priority
                }
              }
            }
          }
        `,
      },
      tokenA,
    );
    expect(roundTrip.payload.errors).toBeUndefined();
    const viewer = roundTrip.payload.data?.viewer as {
      todos: { items: Array<{ id: string; priority: string }> };
    };
    expect(viewer.todos.items).toContainEqual({
      id: todoId,
      priority: "HIGH",
    });

    const cleared = await execute(
      {
        query: /* GraphQL */ `
          mutation ClearContent($id: ID!) {
            todoUpdate(id: $id, input: { content: null }) {
              id
            }
          }
        `,
        variables: { id: todoId },
      },
      tokenA,
    );
    expect(cleared.payload).toEqual({
      data: { todoUpdate: { id: todoId } },
    });
    await expect(
      prisma.todo.findUniqueOrThrow({
        where: { id: todoId },
        select: { content: true, dueAt: true },
      }),
    ).resolves.toEqual({
      content: null,
      dueAt: new Date("2026-08-01T01:00:00.000Z"),
    });

    const otherUser = await execute(
      {
        query:
          "mutation UpdateOther($id: ID!) { todoUpdate(id: $id, input: { completed: true }) { id } }",
        variables: { id: todoId },
      },
      tokenB,
    );
    expectErrorCode(otherUser.payload, "FORBIDDEN");

    const deleted = await execute(
      {
        query:
          "mutation DeleteTodo($id: ID!) { todoDelete(id: $id) { id success } }",
        variables: { id: todoId },
      },
      tokenA,
    );
    expect(deleted.payload).toEqual({
      data: { todoDelete: { id: todoId, success: true } },
    });
  });

  it("rejects explicit null for optional fields that are non-null in REST", async () => {
    const [todoToken, commentToken, section] = await Promise.all([
      signToken(userAId, [restWriteScope("todo")]),
      signToken(userAId, [restWriteScope("comment")]),
      prisma.section.findUniqueOrThrow({
        where: { jwId: DEV_SEED.section.jwId },
        select: { id: true },
      }),
    ]);
    const [todo, comment] = await Promise.all([
      prisma.todo.create({
        data: { userId: userAId, title: `${marker} null guard todo` },
        select: { id: true },
      }),
      prisma.comment.create({
        data: {
          body: `${marker} null guard comment`,
          isAnonymous: false,
          sectionId: section.id,
          status: "active",
          userId: userAId,
          visibility: "public",
        },
        select: { id: true },
      }),
    ]);
    createdCommentIds.push(comment.id);

    const createTodoMutation =
      "mutation($input: CreateTodoInput!) { todoCreate(input: $input) { id } }";
    const updateTodoMutation =
      "mutation($id: ID!, $input: UpdateTodoInput!) { todoUpdate(id: $id, input: $input) { id } }";
    const createCommentMutation =
      "mutation($input: CreateCommentInput!) { commentCreate(input: $input) { id } }";
    const updateCommentMutation =
      "mutation($id: ID!, $input: UpdateCommentInput!) { commentUpdate(id: $id, input: $input) { id } }";
    const commentCreateInput = {
      body: `${marker} invalid comment create`,
      sectionJwId: DEV_SEED.section.jwId,
      targetType: "SECTION",
    };
    const commentUpdateInput = {
      body: `${marker} invalid comment update`,
    };
    const invalidMutations = [
      {
        expectedField: "priority",
        query: createTodoMutation,
        token: todoToken,
        variables: {
          input: { priority: null, title: `${marker} invalid create` },
        },
      },
      {
        expectedField: "title",
        query: updateTodoMutation,
        token: todoToken,
        variables: {
          id: todo.id,
          input: { completed: true, title: null },
        },
      },
      {
        expectedField: "priority",
        query: updateTodoMutation,
        token: todoToken,
        variables: { id: todo.id, input: { priority: null } },
      },
      {
        expectedField: "completed",
        query: updateTodoMutation,
        token: todoToken,
        variables: { id: todo.id, input: { completed: null } },
      },
      ...["targetId", "visibility", "isAnonymous", "attachmentIds"].map(
        (expectedField) => ({
          expectedField,
          query: createCommentMutation,
          token: commentToken,
          variables: {
            input: { ...commentCreateInput, [expectedField]: null },
          },
        }),
      ),
      ...["visibility", "isAnonymous", "attachmentIds"].map(
        (expectedField) => ({
          expectedField,
          query: updateCommentMutation,
          token: commentToken,
          variables: {
            id: comment.id,
            input: { ...commentUpdateInput, [expectedField]: null },
          },
        }),
      ),
    ];

    for (const testCase of invalidMutations) {
      const result = await execute(
        { query: testCase.query, variables: testCase.variables },
        testCase.token,
      );
      expectErrorCode(result.payload, "BAD_USER_INPUT");
      expect(result.payload.errors?.[0]?.message).toBe(
        `${testCase.expectedField} must not be null.`,
      );
    }

    await expect(
      prisma.todo.findUniqueOrThrow({
        where: { id: todo.id },
        select: { completed: true, priority: true, title: true },
      }),
    ).resolves.toEqual({
      completed: false,
      priority: "medium",
      title: `${marker} null guard todo`,
    });
    await expect(
      prisma.comment.findUniqueOrThrow({
        where: { id: comment.id },
        select: { body: true, isAnonymous: true, visibility: true },
      }),
    ).resolves.toEqual({
      body: `${marker} null guard comment`,
      isAnonymous: false,
      visibility: "public",
    });
    await expect(
      prisma.todo.count({
        where: { userId: userAId, title: `${marker} invalid create` },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.comment.count({
        where: { body: `${marker} invalid comment create`, userId: userAId },
      }),
    ).resolves.toBe(0);
  });

  it("rejects non-positive numeric comment selectors even with a valid targetId", async () => {
    const [token, section] = await Promise.all([
      signToken(userAId, [restWriteScope("comment")]),
      prisma.section.findUniqueOrThrow({
        where: { jwId: DEV_SEED.section.jwId },
        select: { id: true },
      }),
    ]);
    const mutation =
      "mutation($input: CreateCommentInput!) { commentCreate(input: $input) { id } }";
    const invalidSelectors = [
      { field: "sectionJwId", value: 0 },
      { field: "sectionJwId", value: -1 },
      { field: "courseJwId", value: 0 },
      { field: "courseJwId", value: -1 },
      { field: "sectionTeacherId", value: 0 },
      { field: "sectionTeacherId", value: -1 },
    ] as const;
    const bodies: string[] = [];

    for (const { field, value } of invalidSelectors) {
      const body = `${marker} invalid ${field} ${value}`;
      bodies.push(body);
      const result = await execute(
        {
          query: mutation,
          variables: {
            input: {
              body,
              targetId: String(section.id),
              targetType: "SECTION",
              [field]: value,
            },
          },
        },
        token,
      );

      expectErrorCode(result.payload, "BAD_USER_INPUT");
      expect(result.payload.errors?.[0]?.message).toBe(
        `${field} must be a positive integer.`,
      );
    }

    await expect(
      prisma.comment.count({
        where: { body: { in: bodies }, userId: userAId },
      }),
    ).resolves.toBe(0);
  });

  it("reuses personal write services and executes top-level mutations serially", async () => {
    const token = await signToken(userAId, [
      restWriteScope("bus"),
      restWriteScope("dashboard"),
      restWriteScope("homework"),
      restWriteScope("subscription"),
    ]);
    const slug = USTC_DASHBOARD_LINKS[0].slug;
    const result = await execute(
      {
        query: /* GraphQL */ `
          mutation PersonalWrites(
            $homeworkId: ID!
            $sectionJwId: Int!
            $slug: String!
            $origin: Int!
            $destination: Int!
          ) {
            completion: homeworkCompletionSet(
              homeworkId: $homeworkId
              completed: true
            ) {
              homeworkId
              completed
            }
            subscribed: subscriptionAdd(jwId: $sectionJwId) {
              sectionJwId
              subscribed
            }
            unsubscribed: subscriptionRemove(jwId: $sectionJwId) {
              sectionJwId
              subscribed
            }
            pinned: linkPinSet(slug: $slug, pinned: true) {
              slug
              pinned
            }
            unpinned: linkPinSet(slug: $slug, pinned: false) {
              slug
              pinned
            }
            savedBus: busPreferencesSet(
              input: {
                preferredOriginCampusId: $origin
                preferredDestinationCampusId: $destination
                showDepartedTrips: true
              }
            ) {
              preferredOriginCampusId
              preferredDestinationCampusId
              showDepartedTrips
            }
          }
        `,
        variables: {
          homeworkId,
          sectionJwId: DEV_SEED.section.jwId,
          slug,
          origin: originCampusId,
          destination: destinationCampusId,
        },
      },
      token,
    );

    expect(result.payload.errors).toBeUndefined();
    expect(result.payload.data).toMatchObject({
      completion: { homeworkId, completed: true },
      subscribed: {
        sectionJwId: DEV_SEED.section.jwId,
        subscribed: true,
      },
      unsubscribed: {
        sectionJwId: DEV_SEED.section.jwId,
        subscribed: false,
      },
      pinned: { slug, pinned: true },
      unpinned: { slug, pinned: false },
      savedBus: {
        preferredOriginCampusId: originCampusId,
        preferredDestinationCampusId: destinationCampusId,
        showDepartedTrips: true,
      },
    });
    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: userAId },
        select: {
          calendarFeedToken: true,
          subscribedSections: {
            where: { jwId: DEV_SEED.section.jwId },
            select: { id: true },
          },
        },
      }),
    ).resolves.toEqual({
      calendarFeedToken: null,
      subscribedSections: [],
    });
    await expect(
      prisma.dashboardLinkPin.count({ where: { userId: userAId, slug } }),
    ).resolves.toBe(0);
  });

  it("retains comment suspension, ownership, lock, reaction, and audit rules", async () => {
    const [tokenA, tokenB] = await Promise.all([
      signToken(userAId, [restWriteScope("comment")]),
      signToken(userBId, [restWriteScope("comment"), restWriteScope("todo")]),
    ]);
    const created = await execute(
      {
        query: /* GraphQL */ `
          mutation CreateComment($sectionJwId: Int!) {
            commentCreate(
              input: {
                targetType: SECTION
                sectionJwId: $sectionJwId
                body: "  ${marker} comment  "
              }
            ) {
              id
            }
          }
        `,
        variables: { sectionJwId: DEV_SEED.section.jwId },
      },
      tokenA,
      {
        "user-agent": "graphql-integration-agent",
        "x-forwarded-for": "192.0.2.10",
      },
    );
    const commentId = (
      created.payload.data?.commentCreate as { id?: string } | undefined
    )?.id;
    expect(commentId).toEqual(expect.any(String));
    createdCommentIds.push(commentId as string);

    await expect(
      prisma.auditLog.findFirstOrThrow({
        where: { action: "comment_create", targetId: commentId },
        select: { ipAddress: true, metadata: true, userAgent: true },
      }),
    ).resolves.toMatchObject({
      ipAddress: "192.0.2.10",
      metadata: { source: "graphql" },
      userAgent: "graphql-integration-agent",
    });

    const changed = await execute(
      {
        query: /* GraphQL */ `
          mutation CommentChanges($id: ID!) {
            commentUpdate(id: $id, input: { body: "${marker} edited" }) {
              id
            }
            added: commentReactionAdd(commentId: $id, type: HEART) {
              active
              changed
            }
            removed: commentReactionRemove(commentId: $id, type: HEART) {
              active
              changed
            }
          }
        `,
        variables: { id: commentId },
      },
      tokenA,
    );
    expect(changed.payload.data).toMatchObject({
      commentUpdate: { id: commentId },
      added: { active: true, changed: true },
      removed: { active: false, changed: true },
    });

    const otherOwner = await execute(
      {
        query:
          "mutation DeleteOther($id: ID!) { commentDelete(id: $id) { success } }",
        variables: { id: commentId },
      },
      tokenB,
    );
    expectErrorCode(otherOwner.payload, "FORBIDDEN");

    const deleted = await execute(
      {
        query:
          "mutation DeleteOwn($id: ID!) { commentDelete(id: $id) { success } }",
        variables: { id: commentId },
      },
      tokenA,
    );
    expect(deleted.payload.data).toEqual({
      commentDelete: { success: true },
    });

    const locked = await execute(
      {
        query:
          "mutation ReactLocked($id: ID!) { commentReactionAdd(commentId: $id, type: HEART) { changed } }",
        variables: { id: commentId },
      },
      tokenA,
    );
    expectErrorCode(locked.payload, "FORBIDDEN");
    expect(locked.payload.errors?.[0]?.message).toBe("Comment is locked.");

    await prisma.userSuspension.create({
      data: { userId: userBId, reason: marker },
    });
    const personalWrite = await execute(
      {
        query: /* GraphQL */ `
          mutation SuspendedPersonalWrite {
            todoCreate(input: { title: "${marker} suspended personal" }) {
              id
            }
          }
        `,
      },
      tokenB,
    );
    expect(personalWrite.payload.errors).toBeUndefined();

    const suspendedComment = await execute(
      {
        query: /* GraphQL */ `
          mutation SuspendedComment($sectionJwId: Int!) {
            commentCreate(
              input: {
                targetType: SECTION
                sectionJwId: $sectionJwId
                body: "${marker} blocked"
              }
            ) {
              id
            }
          }
        `,
        variables: { sectionJwId: DEV_SEED.section.jwId },
      },
      tokenB,
    );
    expectErrorCode(suspendedComment.payload, "FORBIDDEN");
    expect(suspendedComment.payload.errors?.[0]?.message).toBe(
      "Comment writes are suspended.",
    );
  });
});
