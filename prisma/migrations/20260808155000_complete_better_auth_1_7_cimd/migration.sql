-- Better Auth 1.7 RC.3 added explicit client-discovery provenance,
-- application type, and a server-owned scope ceiling for client credentials.
ALTER TABLE "OAuthClient"
  ADD COLUMN "clientDiscoveryId" TEXT,
  ADD COLUMN "clientCredentialsScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "applicationType" TEXT;

UPDATE "OAuthClient"
SET "applicationType" = CASE
  WHEN "type" IN ('web', 'native') THEN "type"
  ELSE NULL
END;

-- The provider now requires one canonical link for each client/resource pair.
-- Keep one existing row before adding the compound uniqueness constraint.
DELETE FROM "oauthClientResource" duplicate
USING "oauthClientResource" retained
WHERE duplicate."clientId" = retained."clientId"
  AND duplicate."resourceId" = retained."resourceId"
  AND duplicate."id" > retained."id";

CREATE UNIQUE INDEX "oauthClientResource_clientId_resourceId_key"
ON "oauthClientResource"("clientId", "resourceId");
