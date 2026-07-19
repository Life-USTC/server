-- Keep one current user grant per OAuth client. Existing duplicate rows came
-- from the custom device flow; the most recently updated row is authoritative.
WITH ranked_consents AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "clientId", "userId"
            ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
        ) AS row_number
    FROM "OAuthConsent"
    WHERE "userId" IS NOT NULL
)
DELETE FROM "OAuthConsent"
WHERE "id" IN (
    SELECT "id"
    FROM ranked_consents
    WHERE row_number > 1
);

ALTER TABLE "OAuthConsent"
ADD COLUMN "grantId" TEXT;

UPDATE "OAuthConsent"
SET "grantId" = gen_random_uuid()::TEXT;

ALTER TABLE "OAuthConsent"
ALTER COLUMN "grantId" SET NOT NULL;

ALTER TABLE "OAuthAccessToken"
ADD COLUMN "grantId" TEXT;

ALTER TABLE "OAuthRefreshToken"
ADD COLUMN "grantId" TEXT;

-- Existing user tokens predate grant lineage and cannot be assigned to a
-- consent generation safely. Trusted skip-consent clients are the only
-- exception because their grants are checked directly against client state.
DELETE FROM "OAuthAccessToken"
WHERE "userId" IS NOT NULL
  AND "clientId" IN (
    SELECT "clientId"
    FROM "OAuthClient"
    WHERE "skipConsent" IS DISTINCT FROM TRUE
  );

DELETE FROM "OAuthRefreshToken"
WHERE "clientId" IN (
    SELECT "clientId"
    FROM "OAuthClient"
    WHERE "skipConsent" IS DISTINCT FROM TRUE
  );

DELETE FROM "DeviceCode"
WHERE "userId" IS NOT NULL
  AND "clientId" IN (
    SELECT "clientId"
    FROM "OAuthClient"
    WHERE "skipConsent" IS DISTINCT FROM TRUE
  );

CREATE UNIQUE INDEX "OAuthConsent_grantId_key"
ON "OAuthConsent"("grantId");

CREATE UNIQUE INDEX "OAuthConsent_clientId_userId_key"
ON "OAuthConsent"("clientId", "userId");

CREATE INDEX "OAuthAccessToken_grantId_idx"
ON "OAuthAccessToken"("grantId");

CREATE INDEX "OAuthRefreshToken_grantId_idx"
ON "OAuthRefreshToken"("grantId");
