import { type APIRequestContext, test as base } from "@playwright/test";
import { symmetricDecrypt } from "better-auth/crypto";
import { importJWK, SignJWT } from "jose";
import { PLAYWRIGHT_BASE_URL } from "../../../e2e/utils/e2e-db/core";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../../../shared/catalog-contract-fixture";
import { createFixturePrisma } from "../../../shared/prisma";

import { type Tokens, transports } from "./_transport";
export type Actor = { id: string; tokens: Tokens; readTokens: Tokens };

/** Arrange and observe only. No application routes or expected values run here. */
export async function createProtocolFixture(
  request: APIRequestContext,
  features: string[],
) {
  const db = createFixturePrisma();
  const origin = PLAYWRIGHT_BASE_URL;
  const marker = `protocol-${crypto.randomUUID()}`;
  const clientId = `${marker}-client`;
  const userIds = [crypto.randomUUID(), crypto.randomUUID()];
  const youngId = `${marker}-event`;
  const organizerId = `${marker}-organizer`;
  let fixture:
    | Awaited<ReturnType<typeof createCatalogContractFixture>>
    | undefined;
  async function cleanup() {
    try {
      await db.comment.deleteMany({ where: { userId: { in: userIds } } });
      await db.homework.deleteMany({ where: { createdById: { in: userIds } } });
      await db.youngEvent.deleteMany({ where: { youngId } });
      await db.youngOrganizer.deleteMany({ where: { id: organizerId } });
      if (fixture) await cleanupCatalogContractFixture(db, fixture);
      await db.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: userIds } }, { subjectUserId: { in: userIds } }],
        },
      });
      await db.featureOperationEvent.deleteMany({
        where: { userId: { in: userIds } },
      });
      await db.oAuthClient.deleteMany({ where: { clientId } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await db.$disconnect();
    }
  }
  try {
    // Keys are provisioned by the actual Worker. Never instantiate its auth singleton in Node.
    const response = await request.get("/api/auth/jwks");
    if (!response.ok())
      throw new Error(`Worker JWKS failed: ${response.status()}`);
    const { keys } = (await response.json()) as { keys: { kid: string }[] };
    const key = await db.jwks.findFirstOrThrow({
      where: { id: { in: keys.map((key) => key.kid) } },
      orderBy: { createdAt: "desc" },
    });
    if (key.alg !== "EdDSA")
      throw new Error("Expected Worker EdDSA signing key");
    const privateJwk = await symmetricDecrypt({
      key: "e2e-dev-secret-not-for-production",
      data: JSON.parse(key.privateKey),
    });
    const signingKey = await importJWK(JSON.parse(privateJwk), "EdDSA");
    fixture = await createCatalogContractFixture(db);
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
    const actors: Actor[] = [];
    for (const id of userIds) {
      const consent = await db.oAuthConsent.findFirstOrThrow({
        where: { clientId, userId: id },
      });
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
      cleanup,
    };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Protocol fixture setup and cleanup failed",
      );
    }
    throw error;
  }
}
export type ProtocolFixture = Awaited<ReturnType<typeof createProtocolFixture>>;

export const test = base.extend<{ features: string[]; h: ProtocolFixture }>({
  features: [[], { option: true }],
  h: async ({ request, features }, use) => {
    const h = await createProtocolFixture(request, features);
    try {
      await use(h);
    } finally {
      await h.cleanup();
    }
  },
});
