import { constantTimeEqual, makeSignature } from "better-auth/crypto";

const SIGNED_QUERY_FIELDS = ["sig", "exp", "ba_iat", "ba_pl"] as const;

export type VerifiedSignedOAuthQuery = {
  issuedAt: Date | null;
  postLoginClearedForSession: string | null;
  query: URLSearchParams;
};

export async function verifySignedOAuthQueryState(
  oauthQuery: string,
  secret: string,
): Promise<VerifiedSignedOAuthQuery | null> {
  const params = new URLSearchParams(oauthQuery);
  const signatures = params.getAll("sig");
  const expirations = params.getAll("exp");
  const issuedAtValues = params.getAll("ba_iat");
  const postLoginValues = params.getAll("ba_pl");
  if (
    signatures.length !== 1 ||
    expirations.length !== 1 ||
    issuedAtValues.length > 1 ||
    postLoginValues.length > 1
  ) {
    return null;
  }

  const expiresAt = Number(expirations[0]) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const signature = signatures[0];
  params.delete("sig");
  const expected = await makeSignature(params.toString(), secret);
  if (!signature || !constantTimeEqual(signature, expected)) return null;

  const issuedAtValue = issuedAtValues[0];
  const issuedAtMs = issuedAtValue ? Number(issuedAtValue) : Number.NaN;
  const issuedAt =
    Number.isFinite(issuedAtMs) && issuedAtMs > 0 ? new Date(issuedAtMs) : null;
  const postLoginClearedForSession = postLoginValues[0] || null;
  for (const field of SIGNED_QUERY_FIELDS) {
    params.delete(field);
  }
  return { issuedAt, postLoginClearedForSession, query: params };
}

export async function verifySignedOAuthQuery(
  oauthQuery: string,
  secret: string,
) {
  return (await verifySignedOAuthQueryState(oauthQuery, secret))?.query ?? null;
}

export async function verifyOAuthProviderSignedQuery(oauthQuery: string) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  const context = await betterAuthInstance.$context;
  return verifySignedOAuthQuery(oauthQuery, context.secret);
}

export async function verifyOAuthProviderSignedQueryState(oauthQuery: string) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  const context = await betterAuthInstance.$context;
  return verifySignedOAuthQueryState(oauthQuery, context.secret);
}
