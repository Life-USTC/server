import { constantTimeEqual, makeSignature } from "better-auth/crypto";

const SIGNED_QUERY_FIELDS = [
  "sig",
  "exp",
  "ba_iat",
  "ba_pl",
  "ba_param",
] as const;

function canonicalizeOAuthQueryParams(params: URLSearchParams) {
  const canonical = new URLSearchParams();
  const entries = [...params.entries()].sort(
    ([keyA, valueA], [keyB, valueB]) => {
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      if (valueA < valueB) return -1;
      if (valueA > valueB) return 1;
      return 0;
    },
  );
  for (const [key, value] of entries) canonical.append(key, value);
  return canonical;
}

function hasValidSignedParameterNames(params: URLSearchParams) {
  const declaredNames = params.getAll("ba_param");
  if (declaredNames.length === 0) return true;
  const declaredNameSet = new Set(declaredNames);
  if (declaredNameSet.size !== declaredNames.length) return false;
  const actualNameSet = new Set(params.keys());
  return (
    declaredNameSet.size === actualNameSet.size &&
    [...actualNameSet].every((name) => declaredNameSet.has(name))
  );
}

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
  if (!hasValidSignedParameterNames(params)) return null;
  const expected = await makeSignature(
    canonicalizeOAuthQueryParams(params).toString(),
    secret,
  );
  const validCanonicalSignature =
    !!signature && constantTimeEqual(signature, expected);
  const validLegacySignature =
    !validCanonicalSignature &&
    !params.has("ba_param") &&
    !!signature &&
    constantTimeEqual(
      signature,
      await makeSignature(params.toString(), secret),
    );
  if (!validCanonicalSignature && !validLegacySignature) return null;

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
