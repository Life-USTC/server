import { describe, expect } from "vitest";
import { USTC_CATALOG_LINKS } from "@/features/catalog-links/lib/catalog-links";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import {
  type GraphqlPayload,
  isolatedGraphqlTest,
} from "../shared/isolated-graphql-fixture";

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
  .extend("mutations", async ({ isolatedDatabase, graphqlRuntime }) => {
    return graphqlRuntime.run(async () => {
      const fixturePrisma = isolatedDatabase.owner;
      const marker = `[integration-test] graphql-mutations-${crypto.randomUUID().slice(0, 12)}`;
      const oauthClientId = `graphql-mutations-${crypto.randomUUID()}`;
      const sectionJwId = 1;
      const youngId = "graphql-mutations-event";
      const originCampusId = 1;
      const destinationCampusId = 2;
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
          data: { email: `${marker}-a@example.test`, name: "GraphQL Mutation A" },
        }),
        fixturePrisma.user.create({
          data: { email: `${marker}-b@example.test`, name: "GraphQL Mutation B" },
        }),
      ]);
      const userAId = userA.id;
      const userBId = userB.id;
      const homework = await fixturePrisma.homework.create({
        data: {
          sectionId: section.id,
          title: "GraphQL mutation homework",
          createdById: userAId,
        },
      });
      await fixturePrisma.busCampus.createMany({
        data: [
          {
            id: originCampusId,
            nameCn: "始发校区",
            latitude: 31.8,
            longitude: 117.2,
          },
          {
            id: destinationCampusId,
            nameCn: "目的校区",
            latitude: 31.9,
            longitude: 117.3,
          },
        ],
      });
      await fixturePrisma.youngEvent.create({
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
        originCampusId,
        destinationCampusId,
        homeworkId: homework.id,
        execute: graphqlRuntime.execute,
        signToken: (userId: string, scopes: string[]) =>
          graphqlRuntime.signToken(userId, oauthClientId, scopes),
      };
    });
  });

function expectErrorCode(payload: GraphqlPayload, code: string) {
  expect(payload.data).toBeNull();
  expect(payload.errors?.[0]?.extensions?.code).toBe(code);
}

describe("GraphQL authenticated mutations", () => {
  it("rejects anonymous and insufficient-scope writes before service execution", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const { fixturePrisma, execute, signToken, userAId } = mutations;
      const anonymous = await execute({
        query: 'mutation { todoCreate(input: { title: "anonymous" }) { id } }',
      });
      expect(anonymous.response.headers.get("cache-control")).toBe("no-store");
      expectErrorCode(anonymous.payload, "UNAUTHENTICATED");

      const readToken = await signToken(userAId, [
        restReadScope("workspace.todo"),
      ]);
      const missingScope = await execute(
        {
          query: 'mutation { todoCreate(input: { title: "read only" }) { id } }',
        },
        readToken,
      );
      expectErrorCode(missingScope.payload, "FORBIDDEN");
      expect(
        missingScope.payload.errors?.[0]?.extensions?.requiredScopes,
      ).toEqual(["workspace.todo:write"]);

      await expect(
        fixturePrisma.todo.count({
          where: { userId: userAId, title: { in: ["anonymous", "read only"] } },
        }),
      ).resolves.toBe(0);
    });
  });

  it("supports bearer todo CRUD while preserving owner isolation and null updates", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const { fixturePrisma, execute, signToken, marker, userAId, userBId } =
        mutations;
      const [tokenA, tokenB] = await Promise.all([
        signToken(userAId, [
          restReadScope("workspace.todo"),
          restWriteScope("workspace.todo"),
        ]),
        signToken(userBId, [restWriteScope("workspace.todo")]),
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
        fixturePrisma.todo.findUniqueOrThrow({
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
        fixturePrisma.todo.findUniqueOrThrow({
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
      expectErrorCode(otherUser.payload, "NOT_FOUND");
      await expect(
        fixturePrisma.todo.findUniqueOrThrow({
          where: { id: todoId },
          select: { completed: true, userId: true },
        }),
      ).resolves.toEqual({ completed: false, userId: userAId });

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
  });

  it("rejects explicit null for optional fields that are non-null in REST", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const { fixturePrisma, execute, signToken, marker, userAId, sectionJwId } =
        mutations;
      const [todoToken, commentToken, section] = await Promise.all([
        signToken(userAId, [restWriteScope("workspace.todo")]),
        signToken(userAId, [restWriteScope("community.comment")]),
        fixturePrisma.section.findUniqueOrThrow({
          where: { jwId: sectionJwId },
          select: { id: true },
        }),
      ]);
      const [todo, comment] = await Promise.all([
        fixturePrisma.todo.create({
          data: { userId: userAId, title: `${marker} null guard todo` },
          select: { id: true },
        }),
        fixturePrisma.comment.create({
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
        fixturePrisma.todo.findUniqueOrThrow({
          where: { id: todo.id },
          select: { completed: true, priority: true, title: true },
        }),
      ).resolves.toEqual({
        completed: false,
        priority: "medium",
        title: `${marker} null guard todo`,
      });
      await expect(
        fixturePrisma.comment.findUniqueOrThrow({
          where: { id: comment.id },
          select: { body: true, isAnonymous: true, visibility: true },
        }),
      ).resolves.toEqual({
        body: `${marker} null guard comment`,
        isAnonymous: false,
        visibility: "public",
      });
      await expect(
        fixturePrisma.todo.count({
          where: { userId: userAId, title: `${marker} invalid create` },
        }),
      ).resolves.toBe(0);
      await expect(
        fixturePrisma.comment.count({
          where: { body: `${marker} invalid comment create`, userId: userAId },
        }),
      ).resolves.toBe(0);
    });
  });

  it("rejects non-positive numeric comment selectors even with a valid targetId", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const { fixturePrisma, execute, signToken, marker, userAId, sectionJwId } =
        mutations;
      const [token, section] = await Promise.all([
        signToken(userAId, [restWriteScope("community.comment")]),
        fixturePrisma.section.findUniqueOrThrow({
          where: { jwId: sectionJwId },
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
        fixturePrisma.comment.count({
          where: { body: { in: bodies }, userId: userAId },
        }),
      ).resolves.toBe(0);
    });
  });

  it("reuses personal write services and executes top-level mutations serially", async ({
    graphqlRuntime,
    mutations,
  }) => {
    await graphqlRuntime.run(async () => {
      const {
        fixturePrisma,
        execute,
        signToken,
        userAId,
        homeworkId,
        originCampusId,
        destinationCampusId,
        sectionJwId,
      } = mutations;
      const token = await signToken(userAId, [
        restWriteScope("workspace.bus-preferences"),
        restWriteScope("workspace.link-pin"),
        restWriteScope("workspace.homework"),
        restWriteScope("workspace.subscription"),
      ]);
      const slug = USTC_CATALOG_LINKS[0].slug;
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
            sectionJwId: sectionJwId,
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
          sectionJwId: sectionJwId,
          subscribed: true,
        },
        unsubscribed: {
          sectionJwId: sectionJwId,
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
        fixturePrisma.user.findUniqueOrThrow({
          where: { id: userAId },
          select: {
            calendarFeedToken: true,
            sectionSubscriptions: {
              where: { section: { jwId: sectionJwId } },
              select: { sectionId: true },
            },
          },
        }),
      ).resolves.toEqual({
        calendarFeedToken: null,
        sectionSubscriptions: [],
      });
      await expect(
        fixturePrisma.workspaceLinkPin.count({
          where: { userId: userAId, slug },
        }),
      ).resolves.toBe(0);
    });
  });

  it("retains comment suspension, ownership, lock, reaction, and audit rules", async ({
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
        userBId,
        sectionJwId,
        youngId,
      } = mutations;
      const [tokenA, tokenB] = await Promise.all([
        signToken(userAId, [restWriteScope("community.comment")]),
        signToken(userBId, [
          restWriteScope("community.comment"),
          restWriteScope("workspace.todo"),
        ]),
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
          variables: { sectionJwId: sectionJwId },
        },
        tokenA,
        {
          "user-agent": "graphql-integration-agent",
          "cf-connecting-ip": "192.0.2.10",
        },
      );
      const commentId = (
        created.payload.data?.commentCreate as { id?: string } | undefined
      )?.id;
      expect(commentId).toEqual(expect.any(String));

      const youngEventComment = await execute(
        {
          query: /* GraphQL */ `
          mutation CreateYoungEventComment($youngId: String!) {
            commentCreate(
              input: {
                targetType: YOUNG_EVENT
                youngId: $youngId
                body: "${marker} young event comment"
              }
            ) {
              id
            }
          }
        `,
          variables: { youngId: youngId },
        },
        tokenA,
      );
      const youngEventCommentId = (
        youngEventComment.payload.data?.commentCreate as
          | { id?: string }
          | undefined
      )?.id;
      expect(youngEventCommentId).toEqual(expect.any(String));
      await expect(
        fixturePrisma.comment.findUniqueOrThrow({
          where: { id: youngEventCommentId },
          select: { youngEventId: true },
        }),
      ).resolves.toMatchObject({ youngEventId: expect.any(Number) });

      await expect(
        fixturePrisma.auditLog.findFirstOrThrow({
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

      await fixturePrisma.userSuspension.create({
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
          variables: { sectionJwId: sectionJwId },
        },
        tokenB,
      );
      expectErrorCode(suspendedComment.payload, "FORBIDDEN");
      expect(suspendedComment.payload.errors?.[0]?.message).toBe(
        "Comment writes are suspended.",
      );
    });
  });
});
