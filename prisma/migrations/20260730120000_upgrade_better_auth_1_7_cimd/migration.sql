-- Better Auth 1.7 keys linked accounts by issuer + subject rather than
-- provider id + subject. Backfill the providers supported by this project.
-- Deployment precondition: if AUTH_OIDC_ISSUER has ever differed from the
-- project's default USTC issuer below, replace that literal with the deployed
-- issuer (or reconcile those rows) before serving authentication traffic.
ALTER TABLE "Account" ADD COLUMN "issuer" TEXT;

UPDATE "Account"
SET "issuer" = CASE
  WHEN "provider" = 'credential' THEN 'local:credential'
  WHEN "provider" = 'google' THEN 'https://accounts.google.com'
  WHEN "provider" = 'oidc' THEN 'https://sso-proxy.lug.ustc.edu.cn/auth/oauth2'
  ELSE 'local:oauth:' || "provider"
END;

ALTER TABLE "Account" ALTER COLUMN "issuer" SET NOT NULL;
DROP INDEX "Account_provider_providerAccountId_key";
CREATE UNIQUE INDEX "Account_issuer_providerAccountId_key"
ON "Account"("issuer", "providerAccountId");

ALTER TABLE "Jwks"
  ADD COLUMN "alg" TEXT,
  ADD COLUMN "crv" TEXT;

ALTER TABLE "OAuthClient"
  ADD COLUMN "backchannelLogoutUri" TEXT,
  ADD COLUMN "backchannelLogoutSessionRequired" BOOLEAN,
  ADD COLUMN "jwks" TEXT,
  ADD COLUMN "jwksUri" TEXT,
  ADD COLUMN "dpopBoundAccessTokens" BOOLEAN DEFAULT false;

ALTER TABLE "OAuthRefreshToken"
  ADD COLUMN "authorizationCodeId" TEXT,
  ADD COLUMN "requestedUserInfoClaims" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "rotatedAt" TIMESTAMP(3),
  ADD COLUMN "rotationReplayResponse" TEXT,
  ADD COLUMN "rotationReplayExpiresAt" TIMESTAMP(3),
  ADD COLUMN "confirmation" JSONB;

CREATE INDEX "OAuthRefreshToken_authorizationCodeId_idx"
ON "OAuthRefreshToken"("authorizationCodeId");

ALTER TABLE "OAuthAccessToken"
  ADD COLUMN "authorizationCodeId" TEXT,
  ADD COLUMN "resources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "requestedUserInfoClaims" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "revoked" TIMESTAMP(3),
  ADD COLUMN "confirmation" JSONB;

CREATE INDEX "OAuthAccessToken_authorizationCodeId_idx"
ON "OAuthAccessToken"("authorizationCodeId");

ALTER TABLE "OAuthConsent"
  ADD COLUMN "resources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "requestedUserInfoClaims" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "oauthResource" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "accessTokenTtl" INTEGER,
  "refreshTokenTtl" INTEGER,
  "signingAlgorithm" TEXT,
  "signingKeyId" TEXT,
  "allowedScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "customClaims" JSONB,
  "dpopBoundAccessTokensRequired" BOOLEAN DEFAULT false,
  "disabled" BOOLEAN DEFAULT false,
  "policyVersion" INTEGER DEFAULT 1,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauthResource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauthResource_identifier_key"
ON "oauthResource"("identifier");

CREATE TABLE "oauthClientResource" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauthClientResource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "oauthClientResource_clientId_idx"
ON "oauthClientResource"("clientId");

CREATE INDEX "oauthClientResource_resourceId_idx"
ON "oauthClientResource"("resourceId");

ALTER TABLE "oauthClientResource"
ADD CONSTRAINT "oauthClientResource_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "oauthClientResource"
ADD CONSTRAINT "oauthClientResource_resourceId_fkey"
FOREIGN KEY ("resourceId") REFERENCES "oauthResource"("identifier")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "oauthClientAssertion" (
  "id" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "oauthClientAssertion_pkey" PRIMARY KEY ("id")
);
