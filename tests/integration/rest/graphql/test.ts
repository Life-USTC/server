import { type APIRequestContext, expect, test } from "@playwright/test";
import { symmetricDecrypt } from "better-auth/crypto";
import { importJWK, SignJWT } from "jose";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";
import { restReadScope, restWriteScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../../../e2e/utils/dev-seed";
import {
  getCurrentSessionUser,
  PLAYWRIGHT_BASE_URL,
} from "../../../e2e/utils/e2e-db";
import { withE2ePrisma } from "../../../e2e/utils/e2e-db/prisma";
import { signInAsDebugUserApi } from "../_harness/auth";

const GRAPHQL_RESOURCE = `${PLAYWRIGHT_BASE_URL}/api/graphql`;
const WRONG_RESOURCE = `${PLAYWRIGHT_BASE_URL}/api/auth`;
const PROFILE_READ_SCOPE = restReadScope("account.profile");
const TODO_READ_SCOPE = restReadScope("workspace.todo");
const TODO_WRITE_SCOPE = restWriteScope("workspace.todo");
const GRAPHQL_SCOPES = [PROFILE_READ_SCOPE, TODO_READ_SCOPE, TODO_WRITE_SCOPE];
const FIXTURE_MARKER = `rest-graphql-${crypto.randomUUID()}`;
const OAUTH_CLIENT_ID = `${FIXTURE_MARKER}-client`;

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

type GraphqlFixture = {
  clientId: string;
  users: {
    a: { id: string; todoId: string; todoTitle: string; grantId: string };
    b: { id: string; todoId: string; todoTitle: string; grantId: string };
  };
};

let graphqlFixture: GraphqlFixture | undefined;

async function createGraphqlFixture(): Promise<GraphqlFixture> {
  return withE2ePrisma((prisma) =>
    prisma.$transaction(async (tx) => {
      const userA = await tx.user.create({
        data: {
          email: `${FIXTURE_MARKER}-a@example.test`,
          name: "REST GraphQL A",
        },
        select: { id: true },
      });
      const userB = await tx.user.create({
        data: {
          email: `${FIXTURE_MARKER}-b@example.test`,
          name: "REST GraphQL B",
        },
        select: { id: true },
      });
      const todoA = await tx.todo.create({
        data: {
          title: `${FIXTURE_MARKER}-todo-a`,
          userId: userA.id,
        },
        select: { id: true, title: true },
      });
      const todoB = await tx.todo.create({
        data: {
          title: `${FIXTURE_MARKER}-todo-b`,
          userId: userB.id,
        },
        select: { id: true, title: true },
      });
      const client = await tx.oAuthClient.create({
        data: {
          clientId: OAUTH_CLIENT_ID,
          name: "REST GraphQL Worker test",
          redirectUris: [`${PLAYWRIGHT_BASE_URL}/graphql-test/callback`],
          scopes: GRAPHQL_SCOPES,
          consents: {
            create: [
              {
                resources: [GRAPHQL_RESOURCE],
                scopes: GRAPHQL_SCOPES,
                userId: userA.id,
              },
              {
                resources: [GRAPHQL_RESOURCE],
                scopes: GRAPHQL_SCOPES,
                userId: userB.id,
              },
            ],
          },
        },
        select: {
          clientId: true,
          consents: { select: { grantId: true, userId: true } },
        },
      });
      const consentA = client.consents.find(
        (consent) => consent.userId === userA.id,
      );
      const consentB = client.consents.find(
        (consent) => consent.userId === userB.id,
      );
      if (!consentA || !consentB) {
        throw new Error("Expected OAuth consent fixtures for both users");
      }

      return {
        clientId: client.clientId,
        users: {
          a: {
            grantId: consentA.grantId,
            id: userA.id,
            todoId: todoA.id,
            todoTitle: todoA.title,
          },
          b: {
            grantId: consentB.grantId,
            id: userB.id,
            todoId: todoB.id,
            todoTitle: todoB.title,
          },
        },
      };
    }),
  );
}

async function deleteGraphqlFixture(fixture: GraphqlFixture) {
  await withE2ePrisma(async (prisma) => {
    await prisma.oAuthClient.deleteMany({
      where: { clientId: fixture.clientId },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [fixture.users.a.id, fixture.users.b.id] },
      },
    });
  });
}

async function signGraphqlToken(
  userId: string,
  grantId: string,
  scopes: string[],
  resource = GRAPHQL_RESOURCE,
) {
  // Sign fixtures with the real Worker's key. Loading the application auth
  // singleton here would initialize the Cloudflare Prisma client inside Node.
  const key = await withE2ePrisma((prisma) =>
    prisma.jwks.findFirstOrThrow({ orderBy: { createdAt: "desc" } }),
  );
  expect(key.alg).toBe("EdDSA");
  const privateJwk = await symmetricDecrypt({
    key: "e2e-dev-secret-not-for-production", // wrangler.e2e.jsonc
    data: JSON.parse(key.privateKey),
  });
  return new SignJWT({
    azp: OAUTH_CLIENT_ID,
    scope: scopes.join(" "),
    [OAUTH_GRANT_ID_CLAIM]: grantId,
  })
    .setProtectedHeader({ alg: "EdDSA", kid: key.id, typ: "JWT" })
    .setSubject(userId)
    .setAudience(resource)
    .setIssuer(`${PLAYWRIGHT_BASE_URL}/api/auth`)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(await importJWK(JSON.parse(privateJwk), "EdDSA"));
}

async function postGraphql(
  request: APIRequestContext,
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

test("Cloudflare Worker serves the public GraphQL endpoint", async ({
  request,
}) => {
  const response = await request.post("/api/graphql", {
    data: {
      query: /* GraphQL */ `
        query WorkerSmoke($courseJwId: Int!, $sectionJwId: Int!) {
          catalog {
            course(jwId: $courseJwId) {
              jwId
              code
            }
            section(jwId: $sectionJwId) {
              jwId
              code
              course {
                jwId
              }
            }
          }
        }
      `,
      variables: {
        courseJwId: DEV_SEED.course.jwId,
        sectionJwId: DEV_SEED.section.jwId,
      },
    },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({
    data: {
      catalog: {
        course: {
          jwId: DEV_SEED.course.jwId,
          code: DEV_SEED.course.code,
        },
        section: {
          jwId: DEV_SEED.section.jwId,
          code: DEV_SEED.section.code,
          course: { jwId: DEV_SEED.course.jwId },
        },
      },
    },
  });
});

test.describe("Cloudflare Worker authenticated GraphQL", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ request }) => {
    // Provision signing keys through the Worker, not through a Node auth clone.
    const jwks = await request.get("/api/auth/jwks");
    expect(jwks.status()).toBe(200);
    expect((await jwks.json()).keys.length).toBeGreaterThan(0);
    graphqlFixture = await createGraphqlFixture();
  });

  test.afterAll(async () => {
    if (graphqlFixture) await deleteGraphqlFixture(graphqlFixture);
    graphqlFixture = undefined;
  });

  test("accepts a session cookie only from a trusted Origin", async ({
    request,
  }) => {
    await signInAsDebugUserApi(request, "/");
    const debugUser = await getCurrentSessionUser(request);

    const trusted = await postGraphql(
      request,
      "{ account { profile { id email } } }",
      { headers: { Origin: PLAYWRIGHT_BASE_URL } },
    );
    expect(trusted.response.status()).toBe(200);
    expect(trusted.response.headers()["cache-control"]).toBe("no-store");
    expect(trusted.payload.errors).toBeUndefined();
    expect(trusted.payload.data?.account).toMatchObject({
      profile: { id: debugUser.id },
    });

    const untrusted = await postGraphql(
      request,
      "{ account { profile { id } } }",
      { headers: { Origin: "https://evil.example" } },
    );
    expect(untrusted.response.status()).toBe(403);
    expectGraphqlError(untrusted.payload, "FORBIDDEN");
  });

  test("accepts a GraphQL audience bearer and rejects a wrong audience", async ({
    request,
  }) => {
    if (!graphqlFixture) throw new Error("GraphQL fixture was not initialized");
    const user = graphqlFixture.users.a;
    const token = await signGraphqlToken(user.id, user.grantId, [
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
      user.id,
      user.grantId,
      [PROFILE_READ_SCOPE],
      WRONG_RESOURCE,
    );
    const wrongAudience = await postGraphql(
      request,
      "{ account { profile { id } } }",
      { headers: { Authorization: `Bearer ${wrongAudienceToken}` } },
    );
    expect(wrongAudience.response.status()).toBe(401);
    expectGraphqlError(wrongAudience.payload, "UNAUTHENTICATED");
  });

  test("rejects a bearer without the selected field scope", async ({
    request,
  }) => {
    if (!graphqlFixture) throw new Error("GraphQL fixture was not initialized");
    const user = graphqlFixture.users.a;
    const profileToken = await signGraphqlToken(user.id, user.grantId, [
      PROFILE_READ_SCOPE,
    ]);
    const response = await postGraphql(
      request,
      "{ viewer: workspace { todos { pageInfo { total } } } }",
      { headers: { Authorization: `Bearer ${profileToken}` } },
    );

    expect(response.response.status()).toBe(403);
    expectGraphqlError(response.payload, "FORBIDDEN", [TODO_READ_SCOPE], {
      viewer: null,
    });

    const readOnlyToken = await signGraphqlToken(user.id, user.grantId, [
      TODO_READ_SCOPE,
    ]);
    const attemptedMutation = await postGraphql(
      request,
      /* GraphQL */ `
        mutation CreateTodo($title: String!) {
          todoCreate(input: { title: $title }) { id }
        }
      `,
      {
        headers: { Authorization: `Bearer ${readOnlyToken}` },
        variables: { title: `${FIXTURE_MARKER}-read-only-mutation` },
      },
    );
    expect(attemptedMutation.response.status()).toBe(403);
    expectGraphqlError(attemptedMutation.payload, "FORBIDDEN", [
      TODO_WRITE_SCOPE,
    ]);
    await expect(
      withE2ePrisma((prisma) =>
        prisma.todo.findMany({
          where: { title: `${FIXTURE_MARKER}-read-only-mutation` },
          select: { id: true },
        }),
      ),
    ).resolves.toEqual([]);
  });

  test("keeps A/B reads and todo mutations isolated by bearer subject", async ({
    request,
  }) => {
    if (!graphqlFixture) throw new Error("GraphQL fixture was not initialized");
    const userA = graphqlFixture.users.a;
    const userB = graphqlFixture.users.b;
    const [tokenA, tokenB] = await Promise.all([
      signGraphqlToken(userA.id, userA.grantId, GRAPHQL_SCOPES),
      signGraphqlToken(userB.id, userB.grantId, GRAPHQL_SCOPES),
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
        variables: { title: `${FIXTURE_MARKER}-created-by-a` },
      },
    );
    expect(created.response.status()).toBe(200);
    expect(created.payload.errors).toBeUndefined();
    const createdTodoId = (
      created.payload.data?.todoCreate as { id?: string } | undefined
    )?.id;
    expect(createdTodoId).toEqual(expect.any(String));
    if (!createdTodoId) throw new Error("Expected todoCreate to return an id");

    try {
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
        withE2ePrisma((prisma) =>
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
        withE2ePrisma((prisma) =>
          prisma.todo.findUniqueOrThrow({
            where: { id: createdTodoId },
            select: { completed: true, userId: true },
          }),
        ),
      ).resolves.toEqual({ completed: true, userId: userA.id });
    } finally {
      await postGraphql(
        request,
        "mutation DeleteOwnTodo($id: ID!) { todoDelete(id: $id) { id success } }",
        {
          headers: { Authorization: `Bearer ${tokenA}` },
          variables: { id: createdTodoId },
        },
      );
    }
  });
});
