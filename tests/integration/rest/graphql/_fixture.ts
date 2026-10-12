import { type APIRequestContext, expect } from "@playwright/test";
import { symmetricDecrypt } from "better-auth/crypto";
import { importJWK, SignJWT } from "jose";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test as base } from "../../../e2e/utils/owned-worker";
import type { TestPrismaClient } from "../../../shared/prisma";

export const PROFILE_READ_SCOPE = "account.profile:read";
export const TODO_READ_SCOPE = "workspace.todo:read";
export const TODO_WRITE_SCOPE = "workspace.todo:write";
export const GRAPHQL_SCOPES = [
  PROFILE_READ_SCOPE,
  TODO_READ_SCOPE,
  TODO_WRITE_SCOPE,
];

type GraphqlFixture = {
  catalog: {
    course: { jwId: number; code: string };
    section: { jwId: number; code: string };
  };
  marker: string;
  keyIds: string[];
  clientId: string;
  users: {
    a: { id: string; todoId: string; todoTitle: string; grantId: string };
    b: { id: string; todoId: string; todoTitle: string; grantId: string };
  };
};

async function createGraphqlFixture(
  prisma: TestPrismaClient,
  origin: string,
  keyIds: string[],
  assertOpen: () => void,
): Promise<GraphqlFixture> {
  const marker = `rest-graphql-${crypto.randomUUID()}`;
  const clientId = `${marker}-client`;
  return prisma.$transaction(async (tx) => {
    assertOpen();
    const course = await tx.course.create({
      data: {
        jwId: 1_700_000_000,
        code: "GRAPHQL-COURSE",
        nameCn: "GraphQL public course",
      },
      select: { jwId: true, code: true, id: true },
    });
    const section = await tx.section.create({
      data: {
        jwId: 1_700_000_001,
        code: "GRAPHQL-SECTION",
        courseId: course.id,
      },
      select: { jwId: true, code: true },
    });
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
        redirectUris: [`${origin}/graphql-test/callback`],
        scopes: GRAPHQL_SCOPES,
        consents: {
          create: [
            {
              resources: [`${origin}/api/graphql`],
              scopes: GRAPHQL_SCOPES,
              userId: userA.id,
            },
            {
              resources: [`${origin}/api/graphql`],
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

    assertOpen();
    return {
      catalog: { course, section },
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
  });
}

export async function signGraphqlToken(
  fixture: GraphqlState,
  userId: string,
  grantId: string,
  scopes: string[],
  resource = `${fixture.origin}/api/graphql`,
) {
  return fixture.run(async () => {
    // Sign fixtures with the real Worker's key. Loading the application auth
    // singleton here would initialize the Cloudflare Prisma client inside Node.
    const key = await fixture.db.jwks.findFirstOrThrow({
      where: { id: { in: fixture.keyIds } },
      orderBy: { createdAt: "desc" },
    });
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
      .setIssuer(`${fixture.origin}/api/auth`)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(await importJWK(JSON.parse(privateJwk), "EdDSA"));
  });
}

type Run = <T>(operation: () => Promise<T>) => Promise<T>;
export type GraphqlState = GraphqlFixture & {
  db: TestPrismaClient;
  origin: string;
  request: Pick<APIRequestContext, "post">;
  run: Run;
  observe: <T>(operation: (db: TestPrismaClient) => Promise<T>) => Promise<T>;
  createSession: IsolatedWorker["createSession"];
};

export const test = base.extend<{
  graphql: GraphqlState;
  _graphqlResources: { start: () => Promise<GraphqlState> };
}>({
  _graphqlResources: async (
    { isolatedWorker, playwright, request, run },
    use,
  ) => {
    const probeId = crypto.randomUUID();
    const probePath = `/__test/community-effects?id=${probeId}`;
    const probeHeaders = {
      "x-test-storage-secret": "local-test-storage-observer",
    };
    let ownedRequest: APIRequestContext | undefined;
    let probeCreated = false;
    let closing = false;
    const operations: Promise<PromiseSettledResult<unknown>>[] = [];
    const assertOpen = () => {
      if (closing) throw new Error("GraphQL resources are closing");
    };
    const own: Run = (operation) => {
      if (closing)
        return Promise.reject(new Error("GraphQL resources are closing"));
      const result = run(async () => {
        assertOpen();
        return operation();
      });
      operations.push(
        result.then(
          (value) => ({ status: "fulfilled", value }),
          (reason) => ({ status: "rejected", reason }),
        ),
      );
      return result;
    };
    const start = () =>
      own(async () => {
        const jwks = await request.get("/api/auth/jwks");
        let keyIds: string[];
        try {
          expect(jwks.status()).toBe(200);
          const { keys } = (await jwks.json()) as { keys: { kid: string }[] };
          expect(keys.length).toBeGreaterThan(0);
          keyIds = keys.map((key) => key.kid);
        } finally {
          await jwks.dispose();
        }
        assertOpen();
        const fixture = await createGraphqlFixture(
          isolatedWorker.database.owner,
          isolatedWorker.origin,
          keyIds,
          assertOpen,
        );
        assertOpen();
        const probe = await request.post(probePath, { headers: probeHeaders });
        try {
          expect(probe.status()).toBe(201);
          probeCreated = true;
          await probe.body();
        } finally {
          await probe.dispose();
        }
        assertOpen();
        ownedRequest = await playwright.request.newContext({
          baseURL: isolatedWorker.origin,
          extraHTTPHeaders: {
            ...probeHeaders,
            "x-test-community-probe": probeId,
          },
        });
        assertOpen();
        const context = ownedRequest;
        return {
          ...fixture,
          db: isolatedWorker.database.owner,
          origin: isolatedWorker.origin,
          run: own,
          observe: (operation) =>
            own(() => operation(isolatedWorker.database.owner)),
          createSession: (id) => own(() => isolatedWorker.createSession(id)),
          request: {
            post: (...args) =>
              own(async () => {
                const response = await context.post(...args);
                await response.body();
                return response;
              }),
          },
        } satisfies GraphqlState;
      });
    try {
      // Native teardown is registered before JWKS, SQL, contexts or bodies start.
      await use({ start });
    } catch (reason) {
      operations.push(Promise.resolve({ status: "rejected", reason }));
    }
    {
      closing = true;
      // Drain whole Node chains before checking their producer tasks or closing contexts.
      const results = await Promise.all(operations);
      try {
        const response = await request.get(probePath, {
          headers: probeHeaders,
        });
        try {
          if (probeCreated) expect(response.status()).toBe(200);
          if (response.status() !== 404) {
            expect(response.status()).toBe(200);
            const effects = await response.json();
            expect(effects.backgroundErrors).toEqual([]);
            expect(
              [...effects.messages, ...effects.purges].every(
                (effect: { outcome: string }) => effect.outcome === "fulfilled",
              ),
            ).toBe(true);
          }
        } finally {
          await response.dispose();
        }
      } catch (reason) {
        results.push({ status: "rejected", reason });
      }
      // This observes real producer completion; it does not claim consumer delivery.
      results.push(
        ...(await Promise.allSettled([
          (async () => {
            const response = await request.delete(probePath, {
              headers: probeHeaders,
            });
            try {
              expect([204, 404]).toContain(response.status());
            } finally {
              await response.dispose();
            }
          })(),
          ownedRequest?.dispose(),
        ])),
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "GraphQL fixture cleanup failed");
    }
  },
  graphql: async ({ _graphqlResources }, use) => {
    await use(await _graphqlResources.start());
  },
});
