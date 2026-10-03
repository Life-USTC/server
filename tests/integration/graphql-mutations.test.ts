import { describe, expect } from "vitest";
import { USTC_CATALOG_LINKS } from "@/features/catalog-links/lib/catalog-links";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import {
  type GraphqlPayload,
  isolatedGraphqlTest,
} from "../shared/isolated-graphql-fixture";
import type { TestPrismaClient } from "../shared/prisma";

const mutationScopes = [
  restReadScope("workspace.todo"),
  restWriteScope("workspace.bus-preferences"),
  restWriteScope("community.comment"),
  restWriteScope("workspace.link-pin"),
  restWriteScope("workspace.homework"),
  restWriteScope("workspace.subscription"),
  restWriteScope("workspace.todo"),
];

const it = isolatedGraphqlTest
  .extend({ graphqlLocale: "zh-cn" as const })
  .extend("mutations", async ({ isolatedDatabase, graphqlRuntime, task }) => {
    const mutations = await graphqlRuntime.run(async () => {
      const fixturePrisma = isolatedDatabase.owner;
      const marker = `[integration-test] graphql-mutations-${crypto.randomUUID().slice(0, 12)}`;
      const oauthClientId = `graphql-mutations-${crypto.randomUUID()}`;
      const sectionJwId = 1;
      const youngId = "graphql-mutations-event";
      const course = await fixturePrisma.course.create({
        data: {
          jwId: 1,
          nameCn: "GraphQL mutation course",
          code: "GRAPHQL-MUTATION",
        },
      });
      const section = await fixturePrisma.section.create({
        data: {
          jwId: sectionJwId,
          code: "GRAPHQL-MUTATION.01",
          courseId: course.id,
        },
      });
      const [userA, userB] = await Promise.all([
        fixturePrisma.user.create({
          data: {
            email: `${marker}-a@example.test`,
            name: "GraphQL Mutation A",
          },
        }),
        fixturePrisma.user.create({
          data: {
            email: `${marker}-b@example.test`,
            name: "GraphQL Mutation B",
          },
        }),
      ]);
      const userAId = userA.id;
      const userBId = userB.id;
      const youngEvent = await fixturePrisma.youngEvent.create({
        data: {
          youngId,
          name: "GraphQL mutation event",
          isActive: true,
          rawJson: {},
        },
      });
      await fixturePrisma.oAuthClient.create({
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
      return {
        fixturePrisma,
        marker,
        userAId,
        userBId,
        sectionJwId,
        youngId,
        sectionId: section.id,
        youngEventId: youngEvent.id,
        execute: graphqlRuntime.execute,
        signToken: (userId: string, scopes: string[]) =>
          graphqlRuntime.signToken(userId, oauthClientId, scopes),
      };
    });
    task.context.signal.throwIfAborted();
    return mutations;
  });

function expectErrorCode(payload: GraphqlPayload, code: string) {
  expect(payload.data).toBeNull();
  expect(payload.errors?.[0]?.extensions?.code).toBe(code);
}

function seedTodo(db: TestPrismaClient, userId: string, title: string) {
  return db.todo.create({
    data: {
      userId,
      title,
      content: "initial",
      priority: "high",
      dueAt: new Date("2026-08-01T01:00:00.000Z"),
    },
  });
}
function seedComment(
  db: TestPrismaClient,
  userId: string,
  sectionId: number,
  body: string,
) {
  return db.comment.create({ data: { userId, sectionId, body } });
}
function readComments(db: TestPrismaClient) {
  return db.comment.findMany({
    orderBy: { id: "asc" },
    include: {
      attachments: { orderBy: { id: "asc" } },
      reactions: { orderBy: { id: "asc" } },
    },
  });
}

describe("GraphQL authenticated mutations", () => {
  for (const authority of ["anonymous", "read-only"] as const) {
    it(`rejects ${authority} todo creation before service execution`, async ({
      graphqlRuntime,
      mutations,
    }) => {
      await graphqlRuntime.run(async () => {
        const {
          fixturePrisma: db,
          execute,
          signToken,
          userAId,
          userBId,
        } = mutations;
        const foreign = await seedTodo(db, userBId, "Foreign todo");
        const token =
          authority === "anonymous"
            ? undefined
            : await signToken(userAId, [restReadScope("workspace.todo")]);
        const result = await execute(
          {
            query:
              'mutation { todoCreate(input: { title: "rejected create" }) { id } }',
          },
          token,
        );
        expect(result.response.headers.get("cache-control")).toBe("no-store");
        expectErrorCode(
          result.payload,
          authority === "anonymous" ? "UNAUTHENTICATED" : "FORBIDDEN",
        );
        if (authority === "read-only")
          expect(
            result.payload.errors?.[0]?.extensions?.requiredScopes,
          ).toEqual(["workspace.todo:write"]);
        expect(await db.todo.findMany()).toEqual([foreign]);
        expect(await db.auditLog.findMany()).toEqual([]);
      });
    });
  }

  it("creates a bearer todo with normalized fields and a zoned due date", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        marker,
        userAId,
        userBId,
      } = mutations;
      const foreign = await seedTodo(db, userBId, "Foreign todo");
      const token = await signToken(userAId, [
        restWriteScope("workspace.todo"),
      ]);
      const created = await execute(
        {
          query: /* GraphQL */ `
          mutation CreateTodo($dueAt: DateTime!) {
            todoCreate(input: { title: "  ${marker} todo  ", content: "  initial  ", priority: HIGH, dueAt: $dueAt }) { id }
          }
        `,
          variables: { dueAt: "2026-08-01T09:00:00+08:00" },
        },
        token,
      );
      expect(created.response.headers.get("cache-control")).toBe("no-store");
      expect(created.payload.errors).toBeUndefined();
      const todoId = (
        created.payload.data?.todoCreate as { id?: string } | undefined
      )?.id;
      expect(todoId).toEqual(expect.any(String));
      expect(await db.todo.findMany({ where: { userId: userAId } })).toEqual([
        {
          id: todoId,
          userId: userAId,
          title: `${marker} todo`,
          content: "initial",
          priority: "high",
          completed: false,
          dueAt: new Date("2026-08-01T01:00:00.000Z"),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
      expect(
        await db.todo.findUniqueOrThrow({ where: { id: foreign.id } }),
      ).toEqual(foreign);
    });
  });

  it("reads the GraphQL priority enum from independently seeded todos", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
      } = mutations;
      const todo = await seedTodo(db, userAId, "High-priority todo");
      await seedTodo(db, userBId, "Foreign high-priority todo");
      await db.todo.create({
        data: { userId: userAId, title: "Low-priority todo", priority: "low" },
      });
      const before = await db.todo.findMany({ orderBy: { id: "asc" } });
      const token = await signToken(userAId, [restReadScope("workspace.todo")]);
      const result = await execute(
        {
          query: /* GraphQL */ `
        query TodoPriority {
          viewer: workspace { todos(filter: { priority: HIGH }, page: { pageSize: 100 }) { items { id priority } } }
        }
      `,
        },
        token,
      );
      expect(result.payload.errors).toBeUndefined();
      expect(result.payload.data).toEqual({
        viewer: { todos: { items: [{ id: todo.id, priority: "HIGH" }] } },
      });
      expect(await db.todo.findMany({ orderBy: { id: "asc" } })).toEqual(
        before,
      );
    });
  });

  it("clears todo content without changing omitted fields or another owner", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
      } = mutations;
      const todo = await seedTodo(db, userAId, "Clear content");
      const foreign = await seedTodo(db, userBId, "Foreign todo");
      const token = await signToken(userAId, [
        restWriteScope("workspace.todo"),
      ]);
      const result = await execute(
        {
          query:
            "mutation ClearContent($id: ID!) { todoUpdate(id: $id, input: { content: null }) { id } }",
          variables: { id: todo.id },
        },
        token,
      );
      expect(result.payload).toEqual({ data: { todoUpdate: { id: todo.id } } });
      expect(
        await db.todo.findUniqueOrThrow({ where: { id: todo.id } }),
      ).toEqual({ ...todo, content: null, updatedAt: expect.any(Date) });
      expect(
        await db.todo.findUniqueOrThrow({ where: { id: foreign.id } }),
      ).toEqual(foreign);
    });
  });

  it("rejects updating a foreign todo without changing either owner", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
      } = mutations;
      const foreign = await seedTodo(db, userAId, "Foreign todo");
      await seedTodo(db, userBId, "Own todo");
      const before = await db.todo.findMany({ orderBy: { id: "asc" } });
      const token = await signToken(userBId, [
        restWriteScope("workspace.todo"),
      ]);
      const result = await execute(
        {
          query:
            "mutation UpdateOther($id: ID!) { todoUpdate(id: $id, input: { completed: true }) { id } }",
          variables: { id: foreign.id },
        },
        token,
      );
      expectErrorCode(result.payload, "NOT_FOUND");
      expect(await db.todo.findMany({ orderBy: { id: "asc" } })).toEqual(
        before,
      );
    });
  });

  it("deletes only the independently seeded owned todo", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
      } = mutations;
      const todo = await seedTodo(db, userAId, "Delete todo");
      const foreign = await seedTodo(db, userBId, "Foreign todo");
      const token = await signToken(userAId, [
        restWriteScope("workspace.todo"),
      ]);
      const result = await execute(
        {
          query:
            "mutation DeleteTodo($id: ID!) { todoDelete(id: $id) { id success } }",
          variables: { id: todo.id },
        },
        token,
      );
      expect(result.payload).toEqual({
        data: { todoDelete: { id: todo.id, success: true } },
      });
      expect(await db.todo.findMany()).toEqual([foreign]);
    });
  });

  it("rejects explicit null for optional fields that are non-null in REST", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma,
        execute,
        signToken,
        marker,
        userAId,
        sectionJwId,
        sectionId,
      } = mutations;
      const [todoToken, commentToken] = await Promise.all([
        signToken(userAId, [restWriteScope("workspace.todo")]),
        signToken(userAId, [restWriteScope("community.comment")]),
      ]);
      const [todo, comment] = await Promise.all([
        fixturePrisma.todo.create({
          data: {
            userId: userAId,
            title: `${marker} null guard todo`,
            priority: "medium",
            completed: false,
          },
          select: { id: true },
        }),
        fixturePrisma.comment.create({
          data: {
            body: `${marker} null guard comment`,
            isAnonymous: false,
            sectionId,
            status: "active",
            userId: userAId,
            visibility: "public",
          },
          select: { id: true },
        }),
      ]);

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
        sectionJwId: sectionJwId,
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

      const beforeTodos = await fixturePrisma.todo.findMany({
        orderBy: { id: "asc" },
      });
      const beforeComments = await readComments(fixturePrisma);
      for (const testCase of invalidMutations) {
        const result = await execute(
          { query: testCase.query, variables: testCase.variables },
          testCase.token,
        );
        expectErrorCode(result.payload, "BAD_USER_INPUT");
        expect(result.payload.errors?.[0]?.message).toBe(
          `${testCase.expectedField} must not be null.`,
        );
        expect(
          await fixturePrisma.todo.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(beforeTodos);
        expect(await readComments(fixturePrisma)).toEqual(beforeComments);
        expect(await fixturePrisma.auditLog.findMany()).toEqual([]);
      }
    });
  });

  it("rejects non-positive numeric comment selectors even with a valid targetId", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const { fixturePrisma, execute, signToken, marker, userAId, sectionId } =
        mutations;
      const token = await signToken(userAId, [
        restWriteScope("community.comment"),
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

      for (const { field, value } of invalidSelectors) {
        const body = `${marker} invalid ${field} ${value}`;
        const result = await execute(
          {
            query: mutation,
            variables: {
              input: {
                body,
                targetId: String(sectionId),
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
        expect(await fixturePrisma.comment.findMany()).toEqual([]);
        expect(await fixturePrisma.auditLog.findMany()).toEqual([]);
      }
    });
  });

  it("executes top-level subscription mutations serially", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
        sectionId,
        sectionJwId,
      } = mutations;
      const foreign = await db.userSectionSubscription.create({
        data: { userId: userBId, sectionId },
      });
      const token = await signToken(userAId, [
        restWriteScope("workspace.subscription"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
          mutation SerialSubscriptions($sectionJwId: Int!) {
            subscribed: subscriptionAdd(jwId: $sectionJwId) { sectionJwId subscribed }
            unsubscribed: subscriptionRemove(jwId: $sectionJwId) { sectionJwId subscribed }
          }
        `,
          variables: { sectionJwId },
        },
        token,
      );
      expect(result.payload).toEqual({
        data: {
          subscribed: { sectionJwId, subscribed: true },
          unsubscribed: { sectionJwId, subscribed: false },
        },
      });
      expect(await db.userSectionSubscription.findMany()).toEqual([foreign]);
      expect(
        await db.user.findUniqueOrThrow({
          where: { id: userAId },
          select: {
            calendarFeedToken: true,
            sectionSubscriptions: { select: { sectionId: true } },
          },
        }),
      ).toEqual({ calendarFeedToken: null, sectionSubscriptions: [] });
    });
  });

  it("executes top-level link pin mutations serially", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
      } = mutations;
      const slug = USTC_CATALOG_LINKS[0].slug;
      const foreign = await db.workspaceLinkPin.create({
        data: { userId: userBId, slug },
      });
      const token = await signToken(userAId, [
        restWriteScope("workspace.link-pin"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
          mutation SerialPins($slug: String!) {
            pinned: linkPinSet(slug: $slug, pinned: true) { slug pinned }
            unpinned: linkPinSet(slug: $slug, pinned: false) { slug pinned }
          }
        `,
          variables: { slug },
        },
        token,
      );
      expect(result.payload).toEqual({
        data: {
          pinned: { slug, pinned: true },
          unpinned: { slug, pinned: false },
        },
      });
      expect(await db.workspaceLinkPin.findMany()).toEqual([foreign]);
    });
  });

  it("persists valid bus campus preferences through GraphQL", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
      } = mutations;
      await db.busCampus.createMany({
        data: [
          { id: 1, nameCn: "始发校区", latitude: 31.8, longitude: 117.2 },
          { id: 2, nameCn: "目的校区", latitude: 31.9, longitude: 117.3 },
        ],
      });
      const foreign = await db.busUserPreference.create({
        data: { userId: userBId, showDepartedTrips: false },
      });
      const token = await signToken(userAId, [
        restWriteScope("workspace.bus-preferences"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
        mutation SaveBus {
          busPreferencesSet(input: { preferredOriginCampusId: 1, preferredDestinationCampusId: 2, showDepartedTrips: true }) {
            preferredOriginCampusId preferredDestinationCampusId showDepartedTrips
          }
        }
      `,
        },
        token,
      );
      const expected = {
        preferredOriginCampusId: 1,
        preferredDestinationCampusId: 2,
        showDepartedTrips: true,
      };
      expect(result.payload).toEqual({ data: { busPreferencesSet: expected } });
      expect(
        await db.busUserPreference.findUniqueOrThrow({
          where: { userId: userAId },
        }),
      ).toEqual({
        userId: userAId,
        ...expected,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(
        await db.busUserPreference.findUniqueOrThrow({
          where: { userId: userBId },
        }),
      ).toEqual(foreign);
    });
  });

  it("completes seeded homework without changing another owner's completion", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
        sectionId,
      } = mutations;
      const homework = await db.homework.create({
        data: {
          sectionId,
          title: "GraphQL completion target",
          createdById: userAId,
        },
      });
      const foreign = await db.homeworkCompletion.create({
        data: { userId: userBId, homeworkId: homework.id },
      });
      const token = await signToken(userAId, [
        restWriteScope("workspace.homework"),
      ]);
      const result = await execute(
        {
          query:
            "mutation CompleteHomework($id: ID!) { homeworkCompletionSet(homeworkId: $id, completed: true) { homeworkId completed } }",
          variables: { id: homework.id },
        },
        token,
      );
      expect(result.payload).toEqual({
        data: {
          homeworkCompletionSet: { homeworkId: homework.id, completed: true },
        },
      });
      expect(
        await db.homeworkCompletion.findUniqueOrThrow({
          where: {
            userId_homeworkId: { userId: userAId, homeworkId: homework.id },
          },
        }),
      ).toEqual({
        userId: userAId,
        homeworkId: homework.id,
        completedAt: expect.any(Date),
      });
      expect(
        await db.homeworkCompletion.findUniqueOrThrow({
          where: {
            userId_homeworkId: { userId: userBId, homeworkId: homework.id },
          },
        }),
      ).toEqual(foreign);
      expect(
        await db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
      ).toEqual(homework);
    });
  });

  it("creates a section comment with GraphQL request audit attribution", async ({
    graphqlRuntime,
    mutations,
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
        sectionJwId,
      } = mutations;
      await seedComment(db, userBId, sectionId, "Foreign comment");
      const before = await readComments(db);
      const token = await signToken(userAId, [
        restWriteScope("community.comment"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
          mutation CreateComment($sectionJwId: Int!) {
            commentCreate(input: { targetType: SECTION, sectionJwId: $sectionJwId, body: "  ${marker} comment  " }) { id }
          }
        `,
          variables: { sectionJwId },
        },
        token,
        {
          "user-agent": "graphql-integration-agent",
          "cf-connecting-ip": "192.0.2.10",
        },
      );
      expect(result.payload.errors).toBeUndefined();
      const commentId = (
        result.payload.data?.commentCreate as { id?: string } | undefined
      )?.id;
      expect(commentId).toEqual(expect.any(String));
      const after = await readComments(db);
      expect(after.filter(({ id }) => id !== commentId)).toEqual(before);
      expect(after.filter(({ id }) => id === commentId)).toMatchObject([
        {
          id: commentId,
          userId: userAId,
          body: `${marker} comment`,
          sectionId,
          youngEventId: null,
          visibility: "public",
          status: "active",
          isAnonymous: false,
          reactions: [],
          attachments: [],
        },
      ]);
      expect(
        await db.auditLog.findMany({
          select: {
            action: true,
            targetId: true,
            userId: true,
            ipAddress: true,
            metadata: true,
            userAgent: true,
          },
        }),
      ).toEqual([
        {
          action: "comment_create",
          targetId: commentId,
          userId: userAId,
          ipAddress: "192.0.2.10",
          metadata: { source: "graphql" },
          userAgent: "graphql-integration-agent",
        },
      ]);
    });
  });

  it("creates a Young event comment from its public identifier", async ({
    graphqlRuntime,
    mutations,
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
        youngId,
        youngEventId,
      } = mutations;
      await seedComment(db, userBId, sectionId, "Foreign section comment");
      const before = await readComments(db);
      const token = await signToken(userAId, [
        restWriteScope("community.comment"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
          mutation CreateYoungEventComment($youngId: String!) {
            commentCreate(input: { targetType: YOUNG_EVENT, youngId: $youngId, body: "${marker} young event comment" }) { id }
          }
        `,
          variables: { youngId },
        },
        token,
      );
      expect(result.payload.errors).toBeUndefined();
      const commentId = (
        result.payload.data?.commentCreate as { id?: string } | undefined
      )?.id;
      expect(commentId).toEqual(expect.any(String));
      const after = await readComments(db);
      expect(after.filter(({ id }) => id !== commentId)).toEqual(before);
      expect(after.filter(({ id }) => id === commentId)).toMatchObject([
        {
          id: commentId,
          userId: userAId,
          body: `${marker} young event comment`,
          sectionId: null,
          youngEventId,
          visibility: "public",
          status: "active",
          isAnonymous: false,
          reactions: [],
          attachments: [],
        },
      ]);
      expect(
        await db.auditLog.findMany({
          select: {
            action: true,
            targetId: true,
            userId: true,
            metadata: true,
          },
        }),
      ).toEqual([
        {
          action: "comment_create",
          targetId: commentId,
          userId: userAId,
          metadata: { source: "graphql" },
        },
      ]);
    });
  });

  it("edits a seeded comment while preserving omitted fields and foreign comments", async ({
    graphqlRuntime,
    mutations,
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
      } = mutations;
      const comment = await seedComment(
        db,
        userAId,
        sectionId,
        "Original comment",
      );
      await seedComment(db, userBId, sectionId, "Foreign comment");
      const before = await readComments(db);
      const token = await signToken(userAId, [
        restWriteScope("community.comment"),
      ]);
      const result = await execute(
        {
          query:
            "mutation EditComment($id: ID!, $body: String!) { commentUpdate(id: $id, input: { body: $body }) { id } }",
          variables: { id: comment.id, body: `${marker} edited` },
        },
        token,
      );
      expect(result.payload).toEqual({
        data: { commentUpdate: { id: comment.id } },
      });
      expect(await readComments(db)).toEqual(
        before.map((row) =>
          row.id === comment.id
            ? { ...row, body: `${marker} edited`, updatedAt: expect.any(Date) }
            : row,
        ),
      );
      expect(
        await db.auditLog.findMany({
          select: {
            action: true,
            targetId: true,
            userId: true,
            metadata: true,
          },
        }),
      ).toEqual([
        {
          action: "comment_edit",
          targetId: comment.id,
          userId: userAId,
          metadata: { source: "graphql" },
        },
      ]);
    });
  });

  for (const operation of ["add", "remove"] as const) {
    it(`comment reaction ${operation} changes only the seeded owner's reaction`, async ({
      graphqlRuntime,
      mutations,
    }) => {
      await graphqlRuntime.run(async () => {
        const {
          fixturePrisma: db,
          execute,
          signToken,
          userAId,
          userBId,
          sectionId,
        } = mutations;
        const comment = await seedComment(
          db,
          userAId,
          sectionId,
          "Reaction target",
        );
        const foreign = await db.commentReaction.create({
          data: { commentId: comment.id, userId: userBId, type: "heart" },
        });
        if (operation === "remove")
          await db.commentReaction.create({
            data: { commentId: comment.id, userId: userAId, type: "heart" },
          });
        const token = await signToken(userAId, [
          restWriteScope("community.comment"),
        ]);
        const field =
          operation === "add" ? "commentReactionAdd" : "commentReactionRemove";
        const result = await execute(
          {
            query: `mutation Reaction($id: ID!) { ${field}(commentId: $id, type: HEART) { active changed } }`,
            variables: { id: comment.id },
          },
          token,
        );
        expect(result.payload).toEqual({
          data: { [field]: { active: operation === "add", changed: true } },
        });
        const expected =
          operation === "add"
            ? [
                foreign,
                {
                  id: expect.any(String),
                  commentId: comment.id,
                  userId: userAId,
                  type: "heart",
                  createdAt: expect.any(Date),
                },
              ]
            : [foreign];
        expect(
          await db.commentReaction.findMany({ orderBy: { userId: "asc" } }),
        ).toEqual(expected.sort((a, b) => a.userId.localeCompare(b.userId)));
        expect(await db.comment.findMany()).toEqual([comment]);
        expect(
          await db.auditLog.findMany({
            select: {
              action: true,
              targetId: true,
              userId: true,
              metadata: true,
            },
          }),
        ).toEqual([
          {
            action: "comment_react",
            targetId: comment.id,
            userId: userAId,
            metadata: { source: "graphql", operation, type: "heart" },
          },
        ]);
      });
    });
  }

  it("rejects deletion of a seeded foreign comment without changing rows or audits", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
        sectionId,
      } = mutations;
      const foreign = await seedComment(
        db,
        userAId,
        sectionId,
        "Foreign comment",
      );
      await seedComment(db, userBId, sectionId, "Own comment");
      const before = await readComments(db);
      const token = await signToken(userBId, [
        restWriteScope("community.comment"),
      ]);
      const result = await execute(
        {
          query:
            "mutation DeleteOther($id: ID!) { commentDelete(id: $id) { success } }",
          variables: { id: foreign.id },
        },
        token,
      );
      expectErrorCode(result.payload, "FORBIDDEN");
      expect(await readComments(db)).toEqual(before);
      expect(await db.auditLog.findMany()).toEqual([]);
    });
  });

  it("soft-deletes a seeded owned comment and records its audit", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
        sectionId,
      } = mutations;
      const comment = await seedComment(
        db,
        userAId,
        sectionId,
        "Delete own comment",
      );
      await seedComment(db, userBId, sectionId, "Foreign comment");
      const before = await readComments(db);
      const token = await signToken(userAId, [
        restWriteScope("community.comment"),
      ]);
      const result = await execute(
        {
          query:
            "mutation DeleteOwn($id: ID!) { commentDelete(id: $id) { success } }",
          variables: { id: comment.id },
        },
        token,
      );
      expect(result.payload).toEqual({
        data: { commentDelete: { success: true } },
      });
      expect(await readComments(db)).toEqual(
        before.map((row) =>
          row.id === comment.id
            ? {
                ...row,
                status: "deleted",
                deletedAt: expect.any(Date),
                updatedAt: expect.any(Date),
              }
            : row,
        ),
      );
      expect(
        await db.auditLog.findMany({
          select: {
            action: true,
            targetId: true,
            userId: true,
            metadata: true,
          },
        }),
      ).toEqual([
        {
          action: "comment_delete",
          targetId: comment.id,
          userId: userAId,
          metadata: { source: "graphql" },
        },
      ]);
    });
  });

  it("rejects a reaction to an independently seeded deleted comment", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        userAId,
        userBId,
        sectionId,
      } = mutations;
      const comment = await db.comment.create({
        data: {
          userId: userAId,
          sectionId,
          body: "Deleted comment",
          status: "deleted",
          deletedAt: new Date("2026-07-20T00:00:00.000Z"),
        },
      });
      await db.commentReaction.create({
        data: { userId: userBId, commentId: comment.id, type: "heart" },
      });
      const before = await readComments(db);
      const token = await signToken(userAId, [
        restWriteScope("community.comment"),
      ]);
      const result = await execute(
        {
          query:
            "mutation ReactLocked($id: ID!) { commentReactionAdd(commentId: $id, type: HEART) { changed } }",
          variables: { id: comment.id },
        },
        token,
      );
      expectErrorCode(result.payload, "FORBIDDEN");
      expect(result.payload.errors?.[0]?.message).toBe("Comment is locked.");
      expect(await readComments(db)).toEqual(before);
      expect(await db.auditLog.findMany()).toEqual([]);
    });
  });

  it("permits personal todo creation for an independently suspended actor", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma: db,
        execute,
        signToken,
        marker,
        userAId,
        userBId,
      } = mutations;
      const foreign = await seedTodo(db, userAId, "Foreign todo");
      const suspension = await db.userSuspension.create({
        data: { userId: userBId, reason: marker },
      });
      const token = await signToken(userBId, [
        restWriteScope("workspace.todo"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
        mutation SuspendedPersonalWrite { todoCreate(input: { title: "${marker} suspended personal" }) { id } }
      `,
        },
        token,
      );
      expect(result.payload.errors).toBeUndefined();
      const todoId = (
        result.payload.data?.todoCreate as { id?: string } | undefined
      )?.id;
      expect(todoId).toEqual(expect.any(String));
      expect(
        await db.todo.findMany({ where: { userId: userBId } }),
      ).toMatchObject([
        {
          id: todoId,
          userId: userBId,
          title: `${marker} suspended personal`,
          content: null,
          dueAt: null,
          completed: false,
          priority: "medium",
        },
      ]);
      expect(
        await db.todo.findUniqueOrThrow({ where: { id: foreign.id } }),
      ).toEqual(foreign);
      expect(await db.userSuspension.findMany()).toEqual([suspension]);
    });
  });

  it("rejects comment creation for an independently suspended actor without changing rows or audits", async ({
    graphqlRuntime,
    mutations,
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
        sectionJwId,
      } = mutations;
      await seedComment(db, userAId, sectionId, "Foreign comment");
      const suspension = await db.userSuspension.create({
        data: { userId: userBId, reason: marker },
      });
      const before = await readComments(db);
      const token = await signToken(userBId, [
        restWriteScope("community.comment"),
      ]);
      const result = await execute(
        {
          query: /* GraphQL */ `
          mutation SuspendedComment($sectionJwId: Int!) {
            commentCreate(input: { targetType: SECTION, sectionJwId: $sectionJwId, body: "${marker} blocked" }) { id }
          }
        `,
          variables: { sectionJwId },
        },
        token,
      );
      expectErrorCode(result.payload, "FORBIDDEN");
      expect(result.payload.errors?.[0]?.message).toBe(
        "Comment writes are suspended.",
      );
      expect(await readComments(db)).toEqual(before);
      expect(await db.auditLog.findMany()).toEqual([]);
      expect(await db.userSuspension.findMany()).toEqual([suspension]);
    });
  });
});
