import type { APIRequestContext } from "@playwright/test";
import { symmetricDecrypt } from "better-auth/crypto";
import { importJWK, SignJWT } from "jose";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test as base } from "../../../e2e/utils/owned-worker";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";

import { type Tokens, transports } from "./_transport";
export type Actor = { id: string; tokens: Tokens; readTokens: Tokens };

/** Arrange and observe only. No application routes or expected values run here. */
async function createProtocolFixture(
  request: APIRequestContext,
  features: string[],
  worker: IsolatedWorker,
  signal: AbortSignal,
) {
  const db = worker.database.owner;
  const origin = worker.origin;
  const marker = `protocol-${crypto.randomUUID()}`;
  const clientId = `${marker}-client`;
  const userIds = [crypto.randomUUID(), crypto.randomUUID()];
  const youngId = `${marker}-event`;
  const organizerId = `${marker}-organizer`;
  // Keys are provisioned by the actual Worker. Never instantiate its auth singleton in Node.
  const response = await request.get(`${origin}/api/auth/jwks`);
  if (!response.ok())
    throw new Error(`Worker JWKS failed: ${response.status()}`);
  signal.throwIfAborted();
  const { keys } = (await response.json()) as { keys: { kid: string }[] };
  signal.throwIfAborted();
  const key = await db.jwks.findFirstOrThrow({
    where: { id: { in: keys.map((key) => key.kid) } },
    orderBy: { createdAt: "desc" },
  });
  signal.throwIfAborted();
  if (key.alg !== "EdDSA") throw new Error("Expected Worker EdDSA signing key");
  const privateJwk = await symmetricDecrypt({
    key: "e2e-dev-secret-not-for-production",
    data: JSON.parse(key.privateKey),
  });
  signal.throwIfAborted();
  const signingKey = await importJWK(JSON.parse(privateJwk), "EdDSA");
  signal.throwIfAborted();
  const fixture = await createCatalogContractFixture(db);
  signal.throwIfAborted();
  const scopes = features.flatMap((feature) => [
    `${feature}:read`,
    `${feature}:write`,
  ]);
  const resources = {
    rest: `${origin}/api/auth`,
    graphql: `${origin}/api/graphql`,
    mcp: `${origin}/api/mcp`,
  };
  await db.$transaction(async (tx) => {
    await tx.user.createMany({
      data: userIds.map((id) => ({
        id,
        name: id,
        email: `${id}@protocol.test`,
        emailVerified: true,
      })),
    });
    await tx.oAuthClient.create({
      data: {
        clientId,
        name: marker,
        redirectUris: [`${origin}/test/callback`],
        scopes,
        consents: {
          create: userIds.map((userId) => ({
            userId,
            scopes,
            resources: Object.values(resources),
          })),
        },
      },
    });
  });
  signal.throwIfAborted();
  const actors: Actor[] = [];
  for (const id of userIds) {
    const consent = await db.oAuthConsent.findFirstOrThrow({
      where: { clientId, userId: id },
    });
    signal.throwIfAborted();
    const tokens = {} as Tokens;
    const readTokens = {} as Tokens;
    for (const transport of transports) {
      for (const [destination, action] of [
        [tokens, "write"],
        [readTokens, "read"],
      ] as const) {
        destination[transport] = await new SignJWT({
          azp: clientId,
          scope: features.map((feature) => `${feature}:${action}`).join(" "),
          "urn:life-ustc:oauth:grant-id": consent.grantId,
        })
          .setProtectedHeader({ alg: "EdDSA", kid: key.id, typ: "JWT" })
          .setSubject(id)
          .setAudience(resources[transport])
          .setIssuer(`${origin}/api/auth`)
          .setIssuedAt()
          .setExpirationTime("10m")
          .sign(signingKey);
        signal.throwIfAborted();
      }
    }
    actors.push({ id, tokens, readTokens });
  }
  return {
    db,
    origin,
    marker,
    clientId,
    actors,
    fixture,
    section: fixture.sections[0],
    youngId,
    organizerId,
  };
}
export type ProtocolFixture = Awaited<ReturnType<typeof createProtocolFixture>>;

// Register ownership before JWT/catalog setup begins. A native fixture timeout
// cannot release the private database while a delayed setup is still running.
export const test = base.extend<{
  features: string[];
  h: ProtocolFixture;
  _protocolResources: { start: () => Promise<ProtocolFixture> };
}>({
  features: [[], { option: true }],
  _protocolResources: async ({ request, features, isolatedWorker }, use) => {
    const abort = new AbortController();
    let starting: Promise<ProtocolFixture> | undefined;
    try {
      await use({
        start: () => {
          abort.signal.throwIfAborted();
          starting ??= createProtocolFixture(
            request,
            features,
            isolatedWorker,
            abort.signal,
          );
          void starting.catch(() => undefined);
          return starting;
        },
      });
    } finally {
      abort.abort(new Error("Protocol fixture resources disposed"));
      await starting?.catch(() => undefined);
    }
  },
  h: async ({ _protocolResources }, use) => {
    await use(await _protocolResources.start());
  },
});
