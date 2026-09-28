import { type APIRequestContext, test as base, expect } from "@playwright/test";
import { symmetricDecrypt } from "better-auth/crypto";
import { importJWK, SignJWT } from "jose";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";
import { PLAYWRIGHT_BASE_URL } from "../../../e2e/utils/e2e-db";
import { withE2ePrisma } from "../../../e2e/utils/e2e-db/prisma";

export const GRAPHQL_RESOURCE = `${PLAYWRIGHT_BASE_URL}/api/graphql`;
export const WRONG_RESOURCE = `${PLAYWRIGHT_BASE_URL}/api/auth`;
export const PROFILE_READ_SCOPE = "account.profile:read";
export const TODO_READ_SCOPE = "workspace.todo:read";
export const TODO_WRITE_SCOPE = "workspace.todo:write";
export const GRAPHQL_SCOPES = [
  PROFILE_READ_SCOPE,
  TODO_READ_SCOPE,
  TODO_WRITE_SCOPE,
];

type GraphqlFixture = {
  marker: string;
  keyIds: string[];
  clientId: string;
  users: {
    a: { id: string; todoId: string; todoTitle: string; grantId: string };
    b: { id: string; todoId: string; todoTitle: string; grantId: string };
  };
};

async function createGraphqlFixture(keyIds: string[]): Promise<GraphqlFixture> {
  const marker = `rest-graphql-${crypto.randomUUID()}`;
  const clientId = `${marker}-client`;
  return withE2ePrisma((prisma) =>
    prisma.$transaction(async (tx) => {
      const userA = await tx.user.create({
        data: {
          email: `${marker}-a@example.test`,
          name: "REST GraphQL A",
        },
        select: { id: true },
      });
      const userB = await tx.user.create({
        data: {
          email: `${marker}-b@example.test`,
          name: "REST GraphQL B",
        },
        select: { id: true },
      });
      const todoA = await tx.todo.create({
        data: {
          title: `${marker}-todo-a`,
          userId: userA.id,
        },
        select: { id: true, title: true },
      });
      const todoB = await tx.todo.create({
        data: {
          title: `${marker}-todo-b`,
          userId: userB.id,
        },
        select: { id: true, title: true },
      });
      const client = await tx.oAuthClient.create({
        data: {
          clientId,
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
        marker,
        keyIds,
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
  const userIds = [fixture.users.a.id, fixture.users.b.id];
  await withE2ePrisma((db) =>
    db.$transaction(async (prisma) => {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: userIds } }, { subjectUserId: { in: userIds } }],
        },
      });
      await prisma.featureOperationEvent.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.oAuthClient.deleteMany({
        where: { clientId: fixture.clientId },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: userIds },
        },
      });
    }),
  );
}

export async function signGraphqlToken(
  fixture: GraphqlFixture,
  userId: string,
  grantId: string,
  scopes: string[],
  resource = GRAPHQL_RESOURCE,
) {
  // Sign fixtures with the real Worker's key. Loading the application auth
  // singleton here would initialize the Cloudflare Prisma client inside Node.
  const key = await withE2ePrisma((prisma) =>
    prisma.jwks.findFirstOrThrow({
      where: { id: { in: fixture.keyIds } },
      orderBy: { createdAt: "desc" },
    }),
  );
  expect(key.alg).toBe("EdDSA");
  const privateJwk = await symmetricDecrypt({
    key: "e2e-dev-secret-not-for-production", // wrangler.e2e.jsonc
    data: JSON.parse(key.privateKey),
  });
  return new SignJWT({
    azp: fixture.clientId,
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

type GraphqlState = GraphqlFixture & {
  request: Pick<APIRequestContext, "post">;
};
export const test = base.extend<{ graphql: GraphqlState }>({
  graphql: async ({ playwright, request }, use) => {
    // Signing keys come from the real Worker. No Node auth singleton is used.
    const jwks = await request.get("/api/auth/jwks");
    expect(jwks.status()).toBe(200);
    const { keys } = (await jwks.json()) as { keys: { kid: string }[] };
    expect(keys.length).toBeGreaterThan(0);
    const fixture = await createGraphqlFixture(keys.map((key) => key.kid));
    const probeId = crypto.randomUUID();
    const probePath = `/__test/community-effects?id=${probeId}`;
    const probeHeaders = {
      "x-test-storage-secret": "local-test-storage-observer",
    };
    let ownedRequest: APIRequestContext | undefined;
    const requests: Promise<PromiseSettledResult<unknown>>[] = [];
    const outcomes = await Promise.allSettled([
      (async () => {
        expect(
          (await request.post(probePath, { headers: probeHeaders })).status(),
        ).toBe(201);
        ownedRequest = await playwright.request.newContext({
          baseURL: PLAYWRIGHT_BASE_URL,
          extraHTTPHeaders: {
            ...probeHeaders,
            "x-test-community-probe": probeId,
          },
        });
        const context = ownedRequest;
        await use({
          ...fixture,
          request: {
            post: (...args) => {
              const pending = context.post(...args);
              requests.push(
                pending.then(
                  (value) => ({ status: "fulfilled", value }),
                  (reason) => ({ status: "rejected", reason }),
                ),
              );
              return pending;
            },
          },
        });
      })(),
    ]);
    const cleanup = async () => {
      // A timed-out or interrupted body can still have a request in flight.
      // Finish those requests before draining the Worker's deferred tasks.
      const results: PromiseSettledResult<unknown>[] = [];
      for (let next = 0; next < requests.length; next++) {
        results.push(await requests[next]);
      }
      // Wait for this test's real request tasks before deleting their identities.
      // The observation endpoint delegates actual queue and cache operations.
      results.push(
        ...(await Promise.allSettled([
          (async () => {
            try {
              const response = await request.get(probePath, {
                headers: probeHeaders,
              });
              if (response.status() !== 404) {
                expect(response.status()).toBe(200);
                const effects = await response.json();
                expect(effects.backgroundErrors).toEqual([]);
                expect(
                  [...effects.messages, ...effects.purges].every(
                    (effect: { outcome: string }) =>
                      effect.outcome === "fulfilled",
                  ),
                ).toBe(true);
              }
            } finally {
              expect([204, 404]).toContain(
                (
                  await request.delete(probePath, { headers: probeHeaders })
                ).status(),
              );
            }
          })(),
        ])),
      );
      results.push(...(await Promise.allSettled([ownedRequest?.dispose()])));
      results.push(
        ...(await Promise.allSettled([deleteGraphqlFixture(fixture)])),
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "GraphQL fixture cleanup failed");
    };
    outcomes.push(...(await Promise.allSettled([cleanup()])));
    const failures = outcomes.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length === 1) throw failures[0];
    if (failures.length)
      throw new AggregateError(failures, "GraphQL fixture and cleanup failed");
  },
});
