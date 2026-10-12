import { withRuntimeDatabaseAdapter } from "@/lib/db/prisma-adapter";
import { OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE } from "@/lib/oauth/constants";

export type OAuthUserGrantIdentity = {
  clientId: string;
  userId: string;
};

export type OAuthUserGrantEvidence = {
  grantId?: string;
  requireGrantBinding?: boolean;
  scopes?: readonly string[];
};

export type ActiveOAuthUserGrant =
  | { kind: "consent"; consentId: string; grantId: string }
  | { kind: "trusted" };

/**
 * Resource-bound access tokens are stateless JWTs, so signature verification
 * alone cannot observe a user revoking an OAuth application.
 *
 * Keep this check uncached: revocation is expected to take effect on the next
 * protected request. Database failures intentionally reject the request.
 */
export async function resolveActiveOAuthUserGrant({
  clientId,
  grantId,
  requireGrantBinding = false,
  scopes = [],
  userId,
}: OAuthUserGrantIdentity &
  OAuthUserGrantEvidence): Promise<ActiveOAuthUserGrant | null> {
  if (!clientId || !userId) return null;

  // One live snapshot observes client, consent generation, user and replay
  // revocation together, without initializing the auth ORM on every request.
  return withRuntimeDatabaseAdapter("auth", async (adapter) => {
    const result = await adapter.queryRaw({
      sql: `SELECT c."skipConsent" IS TRUE, consent."id", consent."grantId"
        FROM "OAuthClient" c
        LEFT JOIN "OAuthConsent" consent
          ON c."skipConsent" IS NOT TRUE
          AND consent."clientId" = c."clientId"
          AND consent."userId" = $2
          AND ($3::text IS NULL OR consent."grantId" = $3)
          AND (cardinality($4::text[]) = 0 OR consent."scopes" @> $4::text[])
        WHERE c."clientId" = $1 AND NOT c."disabled"
          AND CASE WHEN c."skipConsent" IS TRUE THEN
            EXISTS (SELECT 1 FROM "User" u WHERE u."id" = $2)
            AND NOT EXISTS (
              SELECT 1 FROM "OAuthRefreshToken" r
              WHERE r."clientId" = c."clientId" AND r."userId" = $2
                AND r."revoked" IS NOT NULL
                AND $6 = ANY(r."scopes")
                AND CASE WHEN $3::text IS NOT NULL
                  THEN r."grantId" = $3 OR r."referenceId" = $3
                  ELSE r."grantId" IS NULL AND r."referenceId" IS NULL
                END
            )
          ELSE (NOT $5::boolean OR $3::text IS NOT NULL)
            AND consent."id" IS NOT NULL
          END`,
      args: [
        clientId,
        userId,
        grantId || null,
        [...scopes],
        requireGrantBinding,
        OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE,
      ],
      argTypes: [
        { scalarType: "string", arity: "scalar" },
        { scalarType: "string", arity: "scalar" },
        { scalarType: "string", arity: "scalar" },
        { scalarType: "string", arity: "list" },
        { scalarType: "boolean", arity: "scalar" },
        { scalarType: "string", arity: "scalar" },
      ],
    });
    const row = result.rows[0];
    if (!row) return null;
    // The CASE admits a nontrusted row only when its unique consent exists.
    const [trusted, consentId, currentGrantId] = row as [
      boolean,
      string,
      string,
    ];
    return trusted
      ? { kind: "trusted" }
      : { kind: "consent", consentId, grantId: currentGrantId };
  });
}

export async function hasActiveOAuthUserGrant(
  input: OAuthUserGrantIdentity & OAuthUserGrantEvidence,
): Promise<boolean> {
  return Boolean(await resolveActiveOAuthUserGrant(input));
}
