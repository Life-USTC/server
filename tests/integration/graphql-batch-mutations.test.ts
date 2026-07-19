import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { prisma } from "@/lib/db/prisma";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../fixtures/dev-seed";

const handler = createGraphqlRequestHandler(false);
const marker = `[integration-test] graphql-batches-${Date.now()}`;
const oauthClientId = `graphql-batches-${crypto.randomUUID()}`;
const batchScopes = [
  restReadScope("todo"),
  restWriteScope("todo"),
  restWriteScope("homework"),
  restWriteScope("subscription"),
];

let userAId = "";
let userBId = "";
let ownedCompletionTodoId = "";
let ownedDeleteTodoId = "";
let otherTodoId = "";
let activeHomeworkId = "";
let deletedHomeworkId = "";
let sectionId = 0;
let semesterId = 0;

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
      requestId: "graphql-batches-integration",
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
  const section = await prisma.section.findUniqueOrThrow({
    where: { jwId: DEV_SEED.section.jwId },
    select: { id: true, semesterId: true },
  });
  sectionId = section.id;
  if (section.semesterId == null) {
    throw new Error("GraphQL batch integration requires a semester section");
  }
  semesterId = section.semesterId;

  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${marker}-a@example.test`,
        name: "GraphQL Batch A",
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        email: `${marker}-b@example.test`,
        name: "GraphQL Batch B",
      },
      select: { id: true },
    }),
  ]);
  userAId = userA.id;
  userBId = userB.id;

  const [ownedCompletionTodo, ownedDeleteTodo, otherTodo, active, deleted] =
    await Promise.all([
      prisma.todo.create({
        data: { userId: userAId, title: `${marker} completion` },
        select: { id: true },
      }),
      prisma.todo.create({
        data: { userId: userAId, title: `${marker} delete` },
        select: { id: true },
      }),
      prisma.todo.create({
        data: { userId: userBId, title: `${marker} other` },
        select: { id: true },
      }),
      prisma.homework.create({
        data: {
          createdById: userAId,
          sectionId,
          title: `${marker} active homework`,
        },
        select: { id: true },
      }),
      prisma.homework.create({
        data: {
          createdById: userAId,
          deletedAt: new Date("2026-07-20T00:00:00.000Z"),
          sectionId,
          title: `${marker} deleted homework`,
        },
        select: { id: true },
      }),
      prisma.oAuthClient.create({
        data: {
          clientId: oauthClientId,
          consents: {
            create: { scopes: batchScopes, userId: userAId },
          },
          name: "GraphQL batches integration",
          redirectUris: ["https://graphql.example/callback"],
        },
      }),
    ]);
  ownedCompletionTodoId = ownedCompletionTodo.id;
  ownedDeleteTodoId = ownedDeleteTodo.id;
  otherTodoId = otherTodo.id;
  activeHomeworkId = active.id;
  deletedHomeworkId = deleted.id;
});

afterAll(async () => {
  await prisma.oAuthClient.deleteMany({ where: { clientId: oauthClientId } });
  await prisma.homework.deleteMany({
    where: { id: { in: [activeHomeworkId, deletedHomeworkId] } },
  });
  await prisma.todo.deleteMany({
    where: { userId: { in: [userAId, userBId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userAId, userBId] } },
  });
  await prisma.$disconnect();
});

describe("GraphQL batch mutations", () => {
  it("requires the exact write scope before any batch item changes", async () => {
    const readToken = await signToken(userAId, [restReadScope("todo")]);
    const result = await execute(
      {
        query: /* GraphQL */ `
          mutation SetWithoutWrite($items: [TodoCompletionBatchItemInput!]!) {
            setTodoCompletions(items: $items) {
              results {
                success
              }
            }
          }
        `,
        variables: {
          items: [{ todoId: ownedCompletionTodoId, completed: true }],
        },
      },
      readToken,
    );

    expectErrorCode(result.payload, "FORBIDDEN");
    expect(result.payload.errors?.[0]?.extensions?.requiredScopes).toEqual([
      "todo:write",
    ]);
    await expect(
      prisma.todo.findUniqueOrThrow({
        where: { id: ownedCompletionTodoId },
        select: { completed: true },
      }),
    ).resolves.toEqual({ completed: false });
  });

  it("returns todo completion and delete results per item", async () => {
    const token = await signToken(userAId, [restWriteScope("todo")]);
    const completion = await execute(
      {
        query: /* GraphQL */ `
          mutation SetTodoBatch($items: [TodoCompletionBatchItemInput!]!) {
            setTodoCompletions(items: $items) {
              results {
                success
                todoId
                completed
                todo {
                  id
                  completed
                }
                error {
                  code
                  message
                }
              }
            }
          }
        `,
        variables: {
          items: [
            { todoId: ownedCompletionTodoId, completed: true },
            { todoId: otherTodoId, completed: true },
          ],
        },
      },
      token,
    );

    expect(completion.payload.errors).toBeUndefined();
    expect(completion.payload.data?.setTodoCompletions).toEqual({
      results: [
        {
          success: true,
          todoId: ownedCompletionTodoId,
          completed: true,
          todo: { id: ownedCompletionTodoId, completed: true },
          error: null,
        },
        {
          success: false,
          todoId: otherTodoId,
          completed: true,
          todo: null,
          error: { code: "FORBIDDEN", message: "forbidden" },
        },
      ],
    });

    const deletion = await execute(
      {
        query: /* GraphQL */ `
          mutation DeleteTodoBatch($ids: [ID!]!) {
            deleteTodos(ids: $ids) {
              results {
                success
                id
                error {
                  code
                }
              }
            }
          }
        `,
        variables: {
          ids: [ownedDeleteTodoId, `${marker}-missing`, otherTodoId],
        },
      },
      token,
    );
    expect(deletion.payload.errors).toBeUndefined();
    expect(deletion.payload.data?.deleteTodos).toEqual({
      results: [
        { success: true, id: ownedDeleteTodoId, error: null },
        {
          success: false,
          id: `${marker}-missing`,
          error: { code: "NOT_FOUND" },
        },
        {
          success: false,
          id: otherTodoId,
          error: { code: "FORBIDDEN" },
        },
      ],
    });
  });

  it("rejects duplicate, extra, and null inputs before writing", async () => {
    const token = await signToken(userAId, [restWriteScope("todo")]);
    await prisma.todo.update({
      where: { id: ownedCompletionTodoId },
      data: { completed: false },
    });
    const query = /* GraphQL */ `
      mutation StrictTodoBatch($items: [TodoCompletionBatchItemInput!]!) {
        setTodoCompletions(items: $items) {
          results {
            success
          }
        }
      }
    `;

    const duplicate = await execute(
      {
        query,
        variables: {
          items: [
            { todoId: ownedCompletionTodoId, completed: true },
            { todoId: ` ${ownedCompletionTodoId} `, completed: false },
          ],
        },
      },
      token,
    );
    expectErrorCode(duplicate.payload, "BAD_USER_INPUT");

    for (const items of [
      [{ todoId: ownedCompletionTodoId, completed: true, extra: "reject" }],
      [{ todoId: ownedCompletionTodoId, completed: null }],
    ]) {
      const invalid = await execute({ query, variables: { items } }, token);
      expect(invalid.payload.errors?.length).toBeGreaterThan(0);
      expect(invalid.payload.data).toBeUndefined();
    }

    await expect(
      prisma.todo.findUniqueOrThrow({
        where: { id: ownedCompletionTodoId },
        select: { completed: true },
      }),
    ).resolves.toEqual({ completed: false });
  });

  it("preserves homework per-item not-found and deleted errors", async () => {
    const token = await signToken(userAId, [restWriteScope("homework")]);
    const result = await execute(
      {
        query: /* GraphQL */ `
          mutation SetHomeworkBatch(
            $items: [HomeworkCompletionBatchItemInput!]!
          ) {
            setHomeworkCompletions(items: $items) {
              results {
                success
                homeworkId
                completed
                completedAt
                error {
                  code
                }
              }
            }
          }
        `,
        variables: {
          items: [
            { homeworkId: activeHomeworkId, completed: true },
            { homeworkId: deletedHomeworkId, completed: true },
            { homeworkId: `${marker}-missing`, completed: false },
          ],
        },
      },
      token,
    );

    expect(result.payload.errors).toBeUndefined();
    expect(result.payload.data?.setHomeworkCompletions).toEqual({
      results: [
        {
          success: true,
          homeworkId: activeHomeworkId,
          completed: true,
          completedAt: expect.any(String),
          error: null,
        },
        {
          success: false,
          homeworkId: deletedHomeworkId,
          completed: true,
          completedAt: null,
          error: { code: "DELETED" },
        },
        {
          success: false,
          homeworkId: `${marker}-missing`,
          completed: false,
          completedAt: null,
          error: { code: "NOT_FOUND" },
        },
      ],
    });
  });

  it("applies and clears one semester through the shared subscription service", async () => {
    const token = await signToken(userAId, [restWriteScope("subscription")]);
    const mutation = /* GraphQL */ `
      mutation UpdateSubscriptions($input: UpdateSectionSubscriptionsInput!) {
        updateSectionSubscriptions(input: $input) {
          action
          semesterId
          matchedCodes
          unmatchedCodes
          addedCount
          removedCount
          unchangedCount
          total
        }
      }
    `;
    const added = await execute(
      {
        query: mutation,
        variables: {
          input: {
            action: "ADD",
            codes: [DEV_SEED.section.code, `${marker}-unknown`],
            semesterId,
          },
        },
      },
      token,
    );
    expect(added.payload.errors).toBeUndefined();
    expect(added.payload.data?.updateSectionSubscriptions).toMatchObject({
      action: "ADD",
      semesterId,
      matchedCodes: [DEV_SEED.section.code],
      unmatchedCodes: [`${marker}-unknown`],
      addedCount: 1,
      removedCount: 0,
    });
    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: userAId },
        select: {
          subscribedSections: {
            where: { id: sectionId },
            select: { id: true },
          },
        },
      }),
    ).resolves.toEqual({ subscribedSections: [{ id: sectionId }] });

    const cleared = await execute(
      {
        query: mutation,
        variables: {
          input: { action: "SET", codes: [], semesterId },
        },
      },
      token,
    );
    expect(cleared.payload.errors).toBeUndefined();
    expect(cleared.payload.data?.updateSectionSubscriptions).toMatchObject({
      action: "SET",
      semesterId,
      matchedCodes: [],
      unmatchedCodes: [],
      addedCount: 0,
      removedCount: 1,
      total: 0,
    });
    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: userAId },
        select: {
          subscribedSections: {
            where: { semesterId },
            select: { id: true },
          },
        },
      }),
    ).resolves.toEqual({ subscribedSections: [] });
  });
});
