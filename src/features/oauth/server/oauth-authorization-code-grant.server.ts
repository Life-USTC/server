import { prisma } from "@/lib/db/prisma";
import { resolveActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

type AuthorizationCodeValue = {
  query?: {
    client_id?: unknown;
    scope?: unknown;
  };
  referenceId?: unknown;
  type?: unknown;
  userId?: unknown;
};

function parseAuthorizationCodeValue(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as AuthorizationCodeValue)
      : null;
  } catch {
    return null;
  }
}

function scopeValues(value: unknown) {
  return typeof value === "string"
    ? [...new Set(value.split(/\s+/).filter(Boolean))]
    : [];
}

export async function bindOAuthAuthorizationCodeToActiveGrant(
  code: string,
  expectedClientId?: string,
  expectedGrantId?: string,
  consentUpdatedBefore?: Date,
) {
  if (!code) return false;

  const identifier = await hashOAuthClientSecretForDbStorage(code);
  const row = await prisma.verificationToken.findFirst({
    where: {
      expires: { gt: new Date() },
      identifier,
    },
    select: { id: true, token: true },
  });
  if (!row) return false;

  const value = parseAuthorizationCodeValue(row.token);
  const clientId = value?.query?.client_id;
  const userId = value?.userId;
  if (
    value?.type !== "authorization_code" ||
    typeof clientId !== "string" ||
    (expectedClientId !== undefined && clientId !== expectedClientId) ||
    typeof userId !== "string"
  ) {
    return false;
  }

  const existingGrantId =
    typeof value.referenceId === "string" ? value.referenceId : undefined;
  if (
    expectedGrantId !== undefined &&
    existingGrantId !== undefined &&
    existingGrantId !== expectedGrantId
  ) {
    return false;
  }

  const scopes = scopeValues(value.query?.scope);
  let grantId = expectedGrantId ?? existingGrantId;
  let grant = grantId
    ? await resolveActiveOAuthUserGrant({
        clientId,
        grantId,
        requireGrantBinding: true,
        scopes,
        userId,
      })
    : null;
  if (!grantId) {
    // Better Auth emits skipConsent codes without a reference. Probe a fresh
    // generation so a trusted client can recover from a replayed legacy family.
    const trustedGrantId = crypto.randomUUID();
    grant = await resolveActiveOAuthUserGrant({
      clientId,
      grantId: trustedGrantId,
      requireGrantBinding: true,
      scopes,
      userId,
    });
    if (grant) {
      grantId = trustedGrantId;
    } else {
      // A login continuation has no pre-handler user. Bind its provider-issued
      // code to the consent generation owned by the authenticated code user.
      const consent = await resolveActiveOAuthUserGrant({
        clientId,
        scopes,
        userId,
      });
      if (
        consent?.kind !== "consent" ||
        !consentUpdatedBefore ||
        !(await prisma.oAuthConsent.findFirst({
          where: {
            clientId,
            grantId: consent.grantId,
            id: consent.consentId,
            updatedAt: { lt: consentUpdatedBefore },
            userId,
          },
          select: { id: true },
        }))
      ) {
        return false;
      }
      grant = consent;
      grantId = consent.grantId;
    }
  }
  if (!grant) return false;
  if (grant.kind !== "trusted" && grant.grantId !== grantId) return false;

  const updated = existingGrantId
    ? { count: 1 }
    : await prisma.verificationToken.updateMany({
        where: { id: row.id, token: row.token },
        data: {
          token: JSON.stringify({
            ...value,
            referenceId: grantId,
          }),
        },
      });
  return (
    updated.count === 1 &&
    Boolean(
      await resolveActiveOAuthUserGrant({
        clientId,
        grantId,
        requireGrantBinding: true,
        scopes,
        userId,
      }),
    )
  );
}

export async function bindOAuthAuthorizationCodeRedirectToActiveGrant(
  target: string,
  expectedClientId: string | undefined,
  baseUrl: string,
  expectedGrantId?: string,
  consentUpdatedBefore?: Date,
) {
  let url: URL;
  try {
    url = new URL(target, baseUrl);
  } catch {
    return false;
  }
  const codes = url.searchParams.getAll("code");
  if (codes.length === 0) return true;
  if (codes.length !== 1) return false;
  return bindOAuthAuthorizationCodeToActiveGrant(
    codes[0],
    expectedClientId,
    expectedGrantId,
    consentUpdatedBefore,
  );
}
