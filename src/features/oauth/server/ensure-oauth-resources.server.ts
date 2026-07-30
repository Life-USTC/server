import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { getOAuthProviderValidAudiences } from "@/lib/oauth/resource-urls";
import { OAUTH_PROVIDER_SCOPES } from "@/lib/oauth/scope-registry";

type EnsureOAuthResourcesPrisma = {
  oauthResource: {
    findUnique: (input: {
      where: { identifier: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (input: {
      data: {
        identifier: string;
        name: string;
        allowedScopes: string[];
        dpopBoundAccessTokensRequired: boolean;
        disabled: boolean;
        policyVersion: number;
      };
    }) => Promise<unknown>;
  };
};

let seedPromise: Promise<void> | null = null;

async function seedOAuthProviderResources(prisma: EnsureOAuthResourcesPrisma) {
  const allowedScopes = [...OAUTH_PROVIDER_SCOPES];

  for (const identifier of getOAuthProviderValidAudiences()) {
    const existing = await prisma.oauthResource.findUnique({
      where: { identifier },
      select: { id: true },
    });
    if (existing) continue;

    try {
      await prisma.oauthResource.create({
        data: {
          identifier,
          name: identifier,
          allowedScopes,
          dpopBoundAccessTokensRequired: false,
          disabled: false,
          policyVersion: 1,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/unique|duplicate|UNIQUE/i.test(message)) continue;
      throw error;
    }
  }
}

export async function ensureOAuthProviderResourcesSeeded(
  prisma: EnsureOAuthResourcesPrisma = defaultPrisma,
) {
  if (!seedPromise) {
    seedPromise = seedOAuthProviderResources(prisma).catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

export function resetOAuthProviderResourceSeedForTests() {
  seedPromise = null;
}
