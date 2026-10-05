import { type APIRequestContext, expect } from "@playwright/test";
import {
  GRAPHQL_SCOPES,
  PROFILE_READ_SCOPE,
  signGraphqlToken,
  TODO_READ_SCOPE,
  TODO_WRITE_SCOPE,
  test,
} from "./_fixture";

type GraphqlError = {
  message?: string;
  extensions?: {
    code?: string;
    requiredScopes?: string[];
  };
};

type GraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: GraphqlError[];
};

async function postGraphql(
  request: Pick<APIRequestContext, "post">,
  query: string,
  options: {
    headers?: Record<string, string>;
    variables?: Record<string, unknown>;
  } = {},
) {
  const response = await request.post("/api/graphql", {
    data: {
      query,
      ...(options.variables ? { variables: options.variables } : {}),
    },
    headers: options.headers,
  });
  return {
    payload: (await response.json()) as GraphqlPayload,
    response,
  };
}

function expectGraphqlError(
  payload: GraphqlPayload,
  code: string,
  requiredScopes?: string[],
  expectedData: GraphqlPayload["data"] = null,
) {
  expect(payload.data ?? null).toEqual(expectedData);
  expect(payload.errors?.[0]?.extensions?.code).toBe(code);
  if (requiredScopes) {
    expect(payload.errors?.[0]?.extensions?.requiredScopes).toEqual(
      requiredScopes,
    );
  }
}

for (const domain of ["Course", "Section"] as const) {
  test(`Cloudflare Worker serves the public GraphQL endpoint ${domain}`, {
    tag: `@${domain}/GraphQL`,
  }, async ({ graphql }) => {
    await graphql.run(async () => {
      const { request } = graphql;
      const response = await request.post("/api/graphql", {
        data: {
          query: /* GraphQL */ `
        query WorkerSmoke($jwId: Int!) {
          catalog {
            ${domain === "Course" ? `course(jwId: $jwId) { jwId code }` : `section(jwId: $jwId) { jwId code course { jwId } }`}
          }
        }
      `,
          variables: {
            jwId:
              domain === "Course"
                ? graphql.catalog.course.jwId
                : graphql.catalog.section.jwId,
          },
        },
      });

      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(await response.json()).toEqual({
        data: {
          catalog: {
            ...(domain === "Course"
              ? {
                  course: {
                    jwId: graphql.catalog.course.jwId,
                    code: graphql.catalog.course.code,
                  },
                }
              : {
                  section: {
                    jwId: graphql.catalog.section.jwId,
                    code: graphql.catalog.section.code,
                    course: { jwId: graphql.catalog.course.jwId },
                  },
                }),
          },
        },
      });
    });
  });
}

test.describe("Cloudflare Worker authenticated GraphQL", () => {
  test("accepts a session cookie only from a trusted Origin", {
    tag: "@Account/GraphQL",
  }, async ({ graphql }) => {
    await graphql.run(async () => {
      const { request, users } = graphql;
      const user = users.a;
      const { cookie } = await graphql.createSession(user.id);
      const cookieHeader = `${cookie.name}=${cookie.value}`;

      const trusted = await postGraphql(
        request,
        "{ account { profile { id email } } }",
        { headers: { Origin: graphql.origin, Cookie: cookieHeader } },
      );
      expect(trusted.response.status()).toBe(200);
      expect(trusted.response.headers()["cache-control"]).toBe("no-store");
      expect(trusted.payload.errors).toBeUndefined();
      expect(trusted.payload.data?.account).toMatchObject({
        profile: { id: user.id },
      });

      const untrusted = await postGraphql(
        request,
        "{ account { profile { id } } }",
        { headers: { Origin: "https://evil.example", Cookie: cookieHeader } },
      );
      expect(untrusted.response.status()).toBe(403);
      expectGraphqlError(untrusted.payload, "FORBIDDEN");
    });
  });

  test("accepts a GraphQL audience bearer and rejects a wrong audience", {
    tag: "@Account/GraphQL",
  }, async ({ graphql }) => {
    await graphql.run(async () => {
      const { request } = graphql;
      const user = graphql.users.a;
      const token = await signGraphqlToken(graphql, user.id, user.grantId, [
        PROFILE_READ_SCOPE,
        TODO_READ_SCOPE,
      ]);

      const authorized = await postGraphql(
        request,
        /* GraphQL */ `
        {
          account {
            profile { id }
          }
          viewer: workspace {
            todos {
              items { id title }
              pageInfo { total }
            }
          }
        }
      `,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(authorized.response.status()).toBe(200);
      expect(authorized.response.headers()["cache-control"]).toBe("no-store");
      expect(authorized.payload.errors).toBeUndefined();
      expect(authorized.payload.data).toMatchObject({
        account: { profile: { id: user.id } },
        viewer: {
          todos: {
            items: [{ id: user.todoId, title: user.todoTitle }],
            pageInfo: { total: 1 },
          },
        },
      });

      const wrongAudienceToken = await signGraphqlToken(
        graphql,
        user.id,
        user.grantId,
        [PROFILE_READ_SCOPE],
        `${graphql.origin}/api/auth`,
      );
      const wrongAudience = await postGraphql(
        request,
        "{ account { profile { id } } }",
        { headers: { Authorization: `Bearer ${wrongAudienceToken}` } },
      );
      expect(wrongAudience.response.status()).toBe(401);
      expectGraphqlError(wrongAudience.payload, "UNAUTHENTICATED");
    });
  });

  test("rejects a bearer without the selected field scope", {
    tag: "@Account/GraphQL",
  }, async ({ graphql }) => {
    await graphql.run(async () => {
      const { request, marker } = graphql;
      const user = graphql.users.a;
      const profileToken = await signGraphqlToken(
        graphql,
        user.id,
        user.grantId,
        [PROFILE_READ_SCOPE],
      );
      const response = await postGraphql(
        request,
        "{ viewer: workspace { todos { pageInfo { total } } } }",
        { headers: { Authorization: `Bearer ${profileToken}` } },
      );

      expect(response.response.status()).toBe(403);
      expectGraphqlError(response.payload, "FORBIDDEN", [TODO_READ_SCOPE], {
        viewer: null,
      });

      const readOnlyToken = await signGraphqlToken(
        graphql,
        user.id,
        user.grantId,
        [TODO_READ_SCOPE],
      );
      const attemptedMutation = await postGraphql(
        request,
        /* GraphQL */ `
        mutation CreateTodo($title: String!) {
          todoCreate(input: { title: $title }) { id }
        }
      `,
        {
          headers: { Authorization: `Bearer ${readOnlyToken}` },
          variables: { title: `${marker}-read-only-mutation` },
        },
      );
      expect(attemptedMutation.response.status()).toBe(403);
      expectGraphqlError(attemptedMutation.payload, "FORBIDDEN", [
        TODO_WRITE_SCOPE,
      ]);
      await expect(
        graphql.observe((prisma) =>
          prisma.todo.findMany({
            where: { title: `${marker}-read-only-mutation` },
            select: { id: true },
          }),
        ),
      ).resolves.toEqual([]);
    });
  });

  test("keeps A/B reads and todo mutations isolated by bearer subject", {
    tag: "@Account/GraphQL",
  }, async ({ graphql }) => {
    await graphql.run(async () => {
      const { request, marker } = graphql;
      const userA = graphql.users.a;
      const userB = graphql.users.b;
      const [tokenA, tokenB] = await Promise.all([
        signGraphqlToken(graphql, userA.id, userA.grantId, GRAPHQL_SCOPES),
        signGraphqlToken(graphql, userB.id, userB.grantId, GRAPHQL_SCOPES),
      ]);

      const query = /* GraphQL */ `
      {
        account { profile { id } }
        viewer: workspace {
          todos {
            items { id title }
            pageInfo { total }
          }
        }
      }
    `;
      for (const [token, user, otherUser] of [
        [tokenA, userA, userB],
        [tokenB, userB, userA],
      ] as const) {
        const response = await postGraphql(request, query, {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(response.response.status()).toBe(200);
        expect(response.payload.errors).toBeUndefined();
        expect(response.payload.data).toMatchObject({
          account: { profile: { id: user.id } },
          viewer: {
            todos: {
              items: [{ id: user.todoId, title: user.todoTitle }],
              pageInfo: { total: 1 },
            },
          },
        });
        const items =
          (
            response.payload.data?.viewer as {
              todos?: { items?: Array<{ id?: string }> };
            }
          )?.todos?.items ?? [];
        expect(items.some((item) => item.id === otherUser.todoId)).toBe(false);
      }

      const created = await postGraphql(
        request,
        /* GraphQL */ `
        mutation CreateTodo($title: String!) {
          todoCreate(input: { title: $title }) { id }
        }
      `,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          variables: { title: `${marker}-created-by-a` },
        },
      );
      expect(created.response.status()).toBe(200);
      expect(created.payload.errors).toBeUndefined();
      const createdTodoId = (
        created.payload.data?.todoCreate as { id?: string } | undefined
      )?.id;
      expect(createdTodoId).toEqual(expect.any(String));
      if (!createdTodoId)
        throw new Error("Expected todoCreate to return an id");

      const crossUserUpdate = await postGraphql(
        request,
        /* GraphQL */ `
        mutation UpdateOtherTodo($id: ID!) {
          todoUpdate(id: $id, input: { completed: true }) { id }
        }
      `,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
          variables: { id: createdTodoId },
        },
      );
      expect(crossUserUpdate.response.status()).toBe(404);
      expectGraphqlError(crossUserUpdate.payload, "NOT_FOUND");
      await expect(
        graphql.observe((prisma) =>
          prisma.todo.findUniqueOrThrow({
            where: { id: createdTodoId },
            select: { completed: true, userId: true },
          }),
        ),
      ).resolves.toEqual({ completed: false, userId: userA.id });

      const ownUpdate = await postGraphql(
        request,
        /* GraphQL */ `
        mutation UpdateOwnTodo($id: ID!) {
          todoUpdate(id: $id, input: { completed: true }) { id }
        }
      `,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          variables: { id: createdTodoId },
        },
      );
      expect(ownUpdate.response.status()).toBe(200);
      expect(ownUpdate.payload).toEqual({
        data: { todoUpdate: { id: createdTodoId } },
      });

      await expect(
        graphql.observe((prisma) =>
          prisma.todo.findUniqueOrThrow({
            where: { id: createdTodoId },
            select: { completed: true, userId: true },
          }),
        ),
      ).resolves.toEqual({ completed: true, userId: userA.id });
      const deleted = await postGraphql(
        request,
        "mutation DeleteOwnTodo($id: ID!) { todoDelete(id: $id) { id success } }",
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          variables: { id: createdTodoId },
        },
      );
      expect(deleted.response.status()).toBe(200);
      expect(deleted.payload).toEqual({
        data: { todoDelete: { id: createdTodoId, success: true } },
      });
      await expect(
        graphql.observe((db) =>
          db.todo.findUnique({ where: { id: createdTodoId } }),
        ),
      ).resolves.toBeNull();
    });
  });
});
