import {
  RESOURCE_BOUND_ACCESS_TOKEN_EXPIRES_IN,
  signResourceBoundOAuthAccessToken,
} from "@/features/oauth/server/device-token-issuer.server";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";
import { resolveOAuthResourceAlias } from "@/lib/oauth/resource-aliases";
import { getOAuthProviderValidAudiences } from "@/lib/oauth/resource-urls";
import {
  hashOAuthClientSecretForDbStorage,
  normalizeResourceIndicator,
  resourceIndicatorsMatch,
} from "@/lib/oauth/utils";

type RefreshResourcePrisma = {
  oAuthRefreshToken: {
    findUnique: (input: {
      where: { token: string };
      select: {
        clientId?: true;
        resources: true;
        scopes?: true;
        userId?: true;
      };
    }) => Promise<{
      clientId?: string;
      resources: string[];
      scopes?: string[];
      userId?: string;
    } | null>;
    updateMany: (input: {
      where: { token: string };
      data: { resources: string[] };
    }) => Promise<{ count: number }>;
  };
};

export type RefreshResourceValidationError = {
  approvedResourceCount?: number;
  errorDescription: string;
  requestedResourceCount?: number;
};

function normalizeRequestedResources(resourceValues: string[]) {
  const validAudiences = getOAuthProviderValidAudiences();
  const resources: string[] = [];

  for (const entry of resourceValues) {
    const value = entry.trim();
    if (!value) continue;

    let normalized: string;
    try {
      normalized = normalizeResourceIndicator(resolveOAuthResourceAlias(value));
    } catch {
      continue;
    }

    const matchedAudience = validAudiences.find((audience) =>
      resourceIndicatorsMatch(normalized, audience),
    );
    if (
      matchedAudience &&
      !resources.some((resource) =>
        resourceIndicatorsMatch(resource, matchedAudience),
      )
    ) {
      resources.push(matchedAudience);
    }
  }

  return resources;
}

function parseRequestedRefreshResources(
  resourceValues: string[],
): { resources: string[] } | { error: RefreshResourceValidationError } {
  const validAudiences = getOAuthProviderValidAudiences();
  const resources: string[] = [];

  for (const entry of resourceValues) {
    const value = entry.trim();
    if (!value) {
      return {
        error: { errorDescription: "Requested resource is invalid" },
      };
    }

    let normalized: string;
    try {
      normalized = normalizeResourceIndicator(resolveOAuthResourceAlias(value));
    } catch {
      return {
        error: { errorDescription: "Requested resource is invalid" },
      };
    }

    const matchedAudience = validAudiences.find((audience) =>
      resourceIndicatorsMatch(normalized, audience),
    );
    if (!matchedAudience) {
      return {
        error: {
          errorDescription: "Requested resource is not allowed for this server",
        },
      };
    }

    if (
      !resources.some((resource) =>
        resourceIndicatorsMatch(resource, matchedAudience),
      )
    ) {
      resources.push(matchedAudience);
    }
  }

  return { resources };
}

function normalizeApprovedResources(resources: string[]) {
  const normalized: string[] = [];
  for (const resource of resources) {
    let value: string;
    try {
      value = normalizeResourceIndicator(resource);
    } catch {
      return null;
    }

    if (!normalized.some((approved) => indicatorsMatch(approved, value))) {
      normalized.push(value);
    }
  }
  return normalized;
}

async function getExistingRefreshResources({
  prisma,
  refreshToken,
}: {
  prisma: RefreshResourcePrisma;
  refreshToken: string | null;
}) {
  if (!refreshToken) return [];

  const tokenHash = await hashOAuthClientSecretForDbStorage(refreshToken);
  const refreshRecord = await prisma.oAuthRefreshToken.findUnique({
    where: { token: tokenHash },
    select: { resources: true },
  });
  return normalizeApprovedResources(refreshRecord?.resources ?? []) ?? [];
}

async function resolveApprovedRefreshResources({
  grantType,
  prisma,
  refreshToken,
}: {
  grantType: string | null;
  prisma: RefreshResourcePrisma;
  refreshToken: string | null;
}) {
  if (grantType === OAUTH_REFRESH_TOKEN_GRANT_TYPE) {
    return getExistingRefreshResources({ prisma, refreshToken });
  }
  return [];
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

function getAudienceValues(payload: Record<string, unknown> | null) {
  const aud = payload?.aud;
  if (typeof aud === "string") return [aud];
  if (Array.isArray(aud)) {
    return aud.filter((value) => typeof value === "string");
  }
  return [];
}

function indicatorsMatch(left: string, right: string) {
  try {
    return resourceIndicatorsMatch(left, right);
  } catch {
    return false;
  }
}

function getIssuedAccessTokenResources(
  accessToken: string | undefined,
  requestedResources: string[],
) {
  if (!accessToken || requestedResources.length === 0) return [];

  const audiences = getAudienceValues(decodeJwtPayload(accessToken));
  return requestedResources.filter((resource) =>
    audiences.some((audience) => indicatorsMatch(audience, resource)),
  );
}

function getApprovedRequestedResources(
  resourceValues: string[],
  approvedResources: string[],
) {
  const requestedResources = parseRequestedRefreshResources(resourceValues);
  if ("error" in requestedResources) return [];
  const normalizedApprovedResources =
    normalizeApprovedResources(approvedResources);
  if (!normalizedApprovedResources) return [];

  return requestedResources.resources.filter((requested) =>
    normalizedApprovedResources.some((approved) =>
      indicatorsMatch(approved, requested),
    ),
  );
}

async function resolveIssuedRefreshResources({
  accessToken,
  grantType,
  prisma,
  refreshToken,
  resourceValues,
}: {
  accessToken?: string;
  grantType: string | null;
  prisma: RefreshResourcePrisma;
  refreshToken: string | null;
  resourceValues: string[];
}) {
  if (grantType === OAUTH_AUTHORIZATION_CODE_GRANT_TYPE) {
    return getIssuedAccessTokenResources(
      accessToken,
      normalizeRequestedResources(resourceValues),
    );
  }

  return resolveApprovedRefreshResources({ grantType, prisma, refreshToken });
}

export async function validateRefreshTokenResources({
  grantType,
  hasResource,
  prisma = defaultPrisma,
  refreshToken,
  resourceValues,
}: {
  grantType: string | null;
  hasResource: boolean;
  prisma?: RefreshResourcePrisma;
  refreshToken: string | null;
  resourceValues: string[];
}): Promise<RefreshResourceValidationError | undefined> {
  if (grantType !== OAUTH_REFRESH_TOKEN_GRANT_TYPE || !hasResource) {
    return undefined;
  }

  if (!refreshToken) return undefined;

  const requestedResources = parseRequestedRefreshResources(resourceValues);
  if ("error" in requestedResources) {
    return requestedResources.error;
  }

  const approvedResources = await getExistingRefreshResources({
    prisma,
    refreshToken,
  });
  const allRequestedResourcesApproved = requestedResources.resources.every(
    (requested) =>
      approvedResources.some((approved) =>
        indicatorsMatch(approved, requested),
      ),
  );
  if (allRequestedResourcesApproved) return undefined;

  return {
    approvedResourceCount: approvedResources.length,
    errorDescription:
      "Requested resource is not approved for this refresh token",
    requestedResourceCount: requestedResources.resources.length,
  };
}

export async function issueResourceBoundRefreshAccessToken({
  prisma = defaultPrisma,
  refreshToken,
  resourceValues,
}: {
  prisma?: RefreshResourcePrisma;
  refreshToken: string | null;
  resourceValues: string[];
}) {
  if (!refreshToken || resourceValues.length === 0) return undefined;

  const tokenHash = await hashOAuthClientSecretForDbStorage(refreshToken);
  const refreshRecord = await prisma.oAuthRefreshToken.findUnique({
    where: { token: tokenHash },
    select: {
      clientId: true,
      resources: true,
      scopes: true,
      userId: true,
    },
  });
  if (
    !refreshRecord?.clientId ||
    !refreshRecord.userId ||
    !refreshRecord.scopes
  ) {
    return undefined;
  }

  const resources = getApprovedRequestedResources(
    resourceValues,
    refreshRecord.resources,
  );
  if (resources.length === 0) return undefined;

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + RESOURCE_BOUND_ACCESS_TOKEN_EXPIRES_IN;
  const accessToken = await signResourceBoundOAuthAccessToken({
    clientId: refreshRecord.clientId,
    expiresAt,
    issuedAt,
    resources,
    scopes: refreshRecord.scopes,
    userId: refreshRecord.userId,
  });
  if (!accessToken) return undefined;

  return {
    accessToken,
    expiresIn: RESOURCE_BOUND_ACCESS_TOKEN_EXPIRES_IN,
  };
}

export async function persistRefreshTokenResources({
  accessToken,
  grantType,
  issuedRefreshToken,
  prisma = defaultPrisma,
  refreshToken,
  resourceValues,
}: {
  accessToken?: string;
  grantType: string | null;
  issuedRefreshToken: string;
  prisma?: RefreshResourcePrisma;
  refreshToken: string | null;
  resourceValues: string[];
}): Promise<
  | { persisted: false; resourceCount: number }
  | { error: string; persisted: false; resourceCount: number }
  | { persisted: true; resourceCount: number; updatedCount: number }
> {
  const resources = await resolveIssuedRefreshResources({
    accessToken,
    grantType,
    prisma,
    refreshToken,
    resourceValues,
  });
  if (resources.length === 0) {
    return { persisted: false, resourceCount: 0 };
  }

  try {
    const tokenHash =
      await hashOAuthClientSecretForDbStorage(issuedRefreshToken);
    const result = await prisma.oAuthRefreshToken.updateMany({
      where: { token: tokenHash },
      data: { resources },
    });
    return {
      persisted: true,
      resourceCount: resources.length,
      updatedCount: result.count,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      persisted: false,
      resourceCount: resources.length,
    };
  }
}
