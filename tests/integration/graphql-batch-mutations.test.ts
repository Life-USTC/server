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
            data: {
              userId: userAId,
              title: `${marker} completion`,
              completed: false,
            },
          }),
          fixturePrisma.todo.create({
            data: {
              userId: userAId,
              title: `${marker} delete`,
              completed: false,
            },
          }),
          fixturePrisma.todo.create({
            data: {
              userId: userBId,
              title: `${marker} other`,
              completed: false,
            },
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
      const before = await fixturePrisma.todo.findMany({
        orderBy: { id: "asc" },
      });
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
      expect(
        await fixturePrisma.todo.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(before);
      expect(await fixturePrisma.auditLog.findMany()).toEqual([]);
    });
  });

  it("todo completion batch returns ordered mixed-owner results", async ({
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
        otherTodoId,
      } = batch;
      const before = await fixturePrisma.todo.findMany({
        orderBy: { id: "asc" },
      });
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

      expect(
        await fixturePrisma.todo.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(
        before.map((row) =>
          row.id === ownedCompletionTodoId
            ? { ...row, completed: true, updatedAt: expect.any(Date) }
            : row,
        ),
      );
    });
  });

  it("todo deletion batch returns ordered owned, missing, and foreign results", async ({
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
        ownedDeleteTodoId,
        otherTodoId,
      } = batch;
      const before = await fixturePrisma.todo.findMany({
        orderBy: { id: "asc" },
      });
      const token = await signToken(userAId, [
        restWriteScope("workspace.todo"),
      ]);
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

      expect(
        await fixturePrisma.todo.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(before.filter(({ id }) => id !== ownedDeleteTodoId));
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

      const before = await fixturePrisma.todo.findMany({
        orderBy: { id: "asc" },
      });
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
      expect(
        await fixturePrisma.todo.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(before);
      expect(await fixturePrisma.auditLog.findMany()).toEqual([]);

      for (const items of [
        [{ todoId: ownedCompletionTodoId, completed: true, extra: "reject" }],
        [{ todoId: ownedCompletionTodoId, completed: null }],
      ]) {
        const invalid = await execute({ query, variables: { items } }, token);
        expect(invalid.payload.errors?.length).toBeGreaterThan(0);
        expect(invalid.payload.data).toBeUndefined();
        expect(
          await fixturePrisma.todo.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before);
        expect(await fixturePrisma.auditLog.findMany()).toEqual([]);
      }
    });
  });

  it("graphql.homework-batch-results", async ({ graphqlRuntime, batch }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma,
        userBId,
        execute,
        signToken,
        marker,
        userAId,
        activeHomeworkId,
        deletedHomeworkId,
      } = batch;
      await fixturePrisma.homeworkCompletion.createMany({
        data: [
          { userId: userBId, homeworkId: activeHomeworkId },
          { userId: userBId, homeworkId: deletedHomeworkId },
        ],
      });
      const foreign = await fixturePrisma.homeworkCompletion.findMany({
        orderBy: { homeworkId: "asc" },
      });
      const homeworks = await fixturePrisma.homework.findMany({
        orderBy: { id: "asc" },
      });
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
      expect(
        await fixturePrisma.homeworkCompletion.findMany({
          where: { userId: userBId },
          orderBy: { homeworkId: "asc" },
        }),
      ).toEqual(foreign);
      const own = await fixturePrisma.homeworkCompletion.findMany({
        where: { userId: userAId },
      });
      expect(own).toEqual([
        {
          userId: userAId,
          homeworkId: activeHomeworkId,
          completedAt: expect.any(Date),
        },
      ]);
      const payload = result.payload.data?.homeworkCompletionsSet as {
        results: Array<{ completedAt: string | null }>;
      };
      expect(new Date(payload.results[0].completedAt ?? "").getTime()).toBe(
        own[0].completedAt.getTime(),
      );
      expect(
        await fixturePrisma.homework.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(homeworks);
      expect(await fixturePrisma.auditLog.findMany()).toEqual([]);
    });
  });

  it("subscription import adds matched codes without changing foreign membership", async ({
    graphqlRuntime,
    batch,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        marker,
        userAId,
        userBId,
        sectionId,
        semesterId,
        sectionCode,
      } = batch;
      const foreign = await db.userSectionSubscription.create({
        data: { userId: userBId, sectionId },
      });
      const token = await signToken(userAId, [
        restWriteScope("workspace.subscription"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
          mutation AddSubscriptions($input: UpdateSectionSubscriptionsInput!) {
            subscriptionsImport(input: $input) { action semesterId matchedCodes unmatchedCodes addedCount removedCount unchangedCount total }
          }
        `,
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
      expect(result.payload.errors).toBeUndefined();
      expect(result.payload.data?.subscriptionsImport).toMatchObject({
        action: "ADD",
        semesterId,
        matchedCodes: [sectionCode],
        unmatchedCodes: [`${marker}-unknown`],
        addedCount: 1,
        removedCount: 0,
      });
      expect(
        await db.userSectionSubscription.findMany({
          orderBy: { userId: "asc" },
        }),
      ).toEqual(
        [
          foreign,
          {
            userId: userAId,
            sectionId,
            kind: "regular",
            createdAt: expect.any(Date),
          },
        ].sort((a, b) => a.userId.localeCompare(b.userId)),
      );
    });
  });

  it("subscription import removes only the seeded owner's membership", async ({
    graphqlRuntime,
    batch,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
        sectionId,
        semesterId,
        sectionCode,
      } = batch;
      await db.userSectionSubscription.create({
        data: { userId: userAId, sectionId },
      });
      const foreign = await db.userSectionSubscription.create({
        data: { userId: userBId, sectionId },
      });
      const token = await signToken(userAId, [
        restWriteScope("workspace.subscription"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
          mutation RemoveSubscriptions($input: UpdateSectionSubscriptionsInput!) {
            subscriptionsImport(input: $input) { action semesterId matchedCodes unmatchedCodes addedCount removedCount unchangedCount total }
          }
        `,
          variables: {
            input: { action: "REMOVE", codes: [sectionCode], semesterId },
          },
        },
        token,
      );
      expect(result.payload.errors).toBeUndefined();
      expect(result.payload.data?.subscriptionsImport).toMatchObject({
        action: "REMOVE",
        semesterId,
        matchedCodes: [sectionCode],
        unmatchedCodes: [],
        addedCount: 0,
        removedCount: 1,
        total: 1,
      });
      expect(await db.userSectionSubscription.findMany()).toEqual([foreign]);
    });
  });
});
