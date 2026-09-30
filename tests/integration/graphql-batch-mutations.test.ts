import { describe, expect } from "vitest";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import {
  type GraphqlPayload,
  isolatedGraphqlTest,
} from "../shared/isolated-graphql-fixture";

const batchScopes = [
  restReadScope("workspace.todo"),
  restWriteScope("workspace.todo"),
  restWriteScope("workspace.homework"),
  restWriteScope("workspace.subscription"),
];

const it = isolatedGraphqlTest.extend(
  "batch",
  async ({ isolatedDatabase, graphqlRuntime, task }) => {
    const batch = await graphqlRuntime.run(async () => {
      const fixturePrisma = isolatedDatabase.owner;
      const marker = `[integration-test] graphql-batches-${crypto.randomUUID().slice(0, 12)}`;
      const oauthClientId = `graphql-batches-${crypto.randomUUID().slice(0, 12)}`;
      const sectionCode = "GRAPHQL-BATCH.01";
      const semester = await fixturePrisma.semester.create({
        data: {
          jwId: 1,
          nameCn: "GraphQL batch semester",
          code: "GRAPHQL-BATCH",
        },
      });
      const course = await fixturePrisma.course.create({
        data: {
          jwId: 1,
          nameCn: "GraphQL batch course",
          code: "GRAPHQL-BATCH",
        },
      });
      const section = await fixturePrisma.section.create({
        data: {
          jwId: 1,
          code: sectionCode,
          courseId: course.id,
          semesterId: semester.id,
        },
      });
      const sectionId = section.id;
      const semesterId = semester.id;
      const [userA, userB] = await Promise.all([
        fixturePrisma.user.create({
          data: { email: `${marker}-a@example.test`, name: "GraphQL Batch A" },
        }),
        fixturePrisma.user.create({
          data: { email: `${marker}-b@example.test`, name: "GraphQL Batch B" },
        }),
      ]);
      const userAId = userA.id;
      const userBId = userB.id;
      const [ownedCompletionTodo, ownedDeleteTodo, otherTodo, active, deleted] =
        await Promise.all([
          fixturePrisma.todo.create({
            data: { userId: userAId, title: `${marker} completion` },
          }),
          fixturePrisma.todo.create({
            data: { userId: userAId, title: `${marker} delete` },
          }),
          fixturePrisma.todo.create({
            data: { userId: userBId, title: `${marker} other` },
          }),
          fixturePrisma.homework.create({
            data: {
              createdById: userAId,
              sectionId,
              title: `${marker} active homework`,
            },
          }),
          fixturePrisma.homework.create({
            data: {
              createdById: userAId,
              sectionId,
              deletedAt: new Date("2026-07-20T00:00:00.000Z"),
              title: `${marker} deleted homework`,
            },
          }),
          fixturePrisma.oAuthClient.create({
            data: {
              clientId: oauthClientId,
              consents: { create: { scopes: batchScopes, userId: userAId } },
              name: "GraphQL batches integration",
              redirectUris: ["https://graphql.example/callback"],
            },
          }),
        ]);
      return {
        fixturePrisma,
        marker,
        userAId,
        userBId,
        sectionId,
        semesterId,
        sectionCode,
        ownedCompletionTodoId: ownedCompletionTodo.id,
        ownedDeleteTodoId: ownedDeleteTodo.id,
        otherTodoId: otherTodo.id,
        activeHomeworkId: active.id,
        deletedHomeworkId: deleted.id,
        execute: graphqlRuntime.execute,
        signToken: (userId: string, scopes: string[]) =>
          graphqlRuntime.signToken(userId, oauthClientId, scopes),
      };
    });
    task.context.signal.throwIfAborted();
    return batch;
  },
);

function expectErrorCode(payload: GraphqlPayload, code: string) {
  expect(payload.data).toBeNull();
  expect(payload.errors?.[0]?.extensions?.code).toBe(code);
}

describe("GraphQL batch mutations", () => {
  it("requires the exact write scope before any batch item changes", async ({
    graphqlRuntime,
    batch,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma,
        execute,
        signToken,
        userAId,
        ownedCompletionTodoId,
      } = batch;
      const readToken = await signToken(userAId, [
        restReadScope("workspace.todo"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
          mutation SetWithoutWrite($items: [TodoCompletionBatchItemInput!]!) {
            todoCompletionsSet(items: $items) {
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
        "workspace.todo:write",
      ]);
      await expect(
        fixturePrisma.todo.findUniqueOrThrow({
          where: { id: ownedCompletionTodoId },
          select: { completed: true },
        }),
      ).resolves.toEqual({ completed: false });
    });
  });

  it("graphql.todo-batch-results", async ({ graphqlRuntime, batch }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma,
        execute,
        signToken,
        marker,
        userAId,
        userBId,
        ownedCompletionTodoId,
        ownedDeleteTodoId,
        otherTodoId,
      } = batch;
      const token = await signToken(userAId, [
        restWriteScope("workspace.todo"),
      ]);
      const completion = await execute(
        {
          query: /* GraphQL */ `
          mutation SetTodoBatch($items: [TodoCompletionBatchItemInput!]!) {
            todoCompletionsSet(items: $items) {
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
      expect(completion.payload.data?.todoCompletionsSet).toEqual({
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
            error: { code: "NOT_FOUND", message: "not_found" },
          },
        ],
      });

      const deletion = await execute(
        {
          query: /* GraphQL */ `
          mutation DeleteTodoBatch($ids: [ID!]!) {
            todosDelete(ids: $ids) {
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
      expect(deletion.payload.data?.todosDelete).toEqual({
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
            error: { code: "NOT_FOUND" },
          },
        ],
      });
      await expect(
        fixturePrisma.todo.findUniqueOrThrow({
          where: { id: otherTodoId },
          select: { userId: true, completed: true },
        }),
      ).resolves.toEqual({ userId: userBId, completed: false });
      await expect(
        fixturePrisma.todo.findUnique({ where: { id: ownedDeleteTodoId } }),
      ).resolves.toBeNull();
      await expect(
        fixturePrisma.todo.findUniqueOrThrow({
          where: { id: ownedCompletionTodoId },
          select: { completed: true },
        }),
      ).resolves.toEqual({ completed: true });
    });
  });

  it("rejects duplicate, extra, and null inputs before writing", async ({
    graphqlRuntime,
    batch,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma,
        execute,
        signToken,
        userAId,
        ownedCompletionTodoId,
      } = batch;
      const token = await signToken(userAId, [
        restWriteScope("workspace.todo"),
      ]);
      const query = /* GraphQL */ `
      mutation StrictTodoBatch($items: [TodoCompletionBatchItemInput!]!) {
        todoCompletionsSet(items: $items) {
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
        fixturePrisma.todo.findUniqueOrThrow({
          where: { id: ownedCompletionTodoId },
          select: { completed: true },
        }),
      ).resolves.toEqual({ completed: false });
    });
  });

  it("graphql.homework-batch-results", async ({ graphqlRuntime, batch }) => {
    await graphqlRuntime.run(async () => {
      const {
        execute,
        signToken,
        marker,
        userAId,
        activeHomeworkId,
        deletedHomeworkId,
      } = batch;
      const token = await signToken(userAId, [
        restWriteScope("workspace.homework"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
          mutation SetHomeworkBatch(
            $items: [HomeworkCompletionBatchItemInput!]!
          ) {
            homeworkCompletionsSet(items: $items) {
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
      expect(result.payload.data?.homeworkCompletionsSet).toEqual({
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
  });

  it("graphql.subscription-batch-results", async ({
    graphqlRuntime,
    batch,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma,
        execute,
        signToken,
        marker,
        userAId,
        sectionId,
        semesterId,
        sectionCode,
      } = batch;
      const token = await signToken(userAId, [
        restWriteScope("workspace.subscription"),
      ]);
      const mutation = /* GraphQL */ `
      mutation UpdateSubscriptions($input: UpdateSectionSubscriptionsInput!) {
        subscriptionsImport(input: $input) {
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
              codes: [sectionCode, `${marker}-unknown`],
              semesterId,
            },
          },
        },
        token,
      );
      expect(added.payload.errors).toBeUndefined();
      expect(added.payload.data?.subscriptionsImport).toMatchObject({
        action: "ADD",
        semesterId,
        matchedCodes: [sectionCode],
        unmatchedCodes: [`${marker}-unknown`],
        addedCount: 1,
        removedCount: 0,
      });
      await expect(
        fixturePrisma.user.findUniqueOrThrow({
          where: { id: userAId },
          select: {
            sectionSubscriptions: {
              where: { sectionId },
              select: { sectionId: true },
            },
          },
        }),
      ).resolves.toEqual({ sectionSubscriptions: [{ sectionId }] });

      const removed = await execute(
        {
          query: mutation,
          variables: {
            input: {
              action: "REMOVE",
              codes: [sectionCode],
              semesterId,
            },
          },
        },
        token,
      );
      expect(removed.payload.errors).toBeUndefined();
      expect(removed.payload.data?.subscriptionsImport).toMatchObject({
        action: "REMOVE",
        semesterId,
        matchedCodes: [sectionCode],
        unmatchedCodes: [],
        addedCount: 0,
        removedCount: 1,
        total: 1,
      });
      await expect(
        fixturePrisma.user.findUniqueOrThrow({
          where: { id: userAId },
          select: {
            sectionSubscriptions: {
              where: { section: { semesterId } },
              select: { sectionId: true },
            },
          },
        }),
      ).resolves.toEqual({ sectionSubscriptions: [] });
    });
  });
});
