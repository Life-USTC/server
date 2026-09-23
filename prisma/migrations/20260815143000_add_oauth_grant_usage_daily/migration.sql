CREATE TABLE "OAuthGrantUsageDaily" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "grantId" TEXT,
  "grantKey" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "feature" TEXT NOT NULL,
  "channel" "AuditChannel" NOT NULL,
  "readCount" INTEGER NOT NULL DEFAULT 0,
  "writeCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OAuthGrantUsageDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthGrantUsageDaily_userId_clientId_grantKey_day_feature_channel_key"
  ON "OAuthGrantUsageDaily"("userId", "clientId", "grantKey", "day", "feature", "channel");
CREATE INDEX "OAuthGrantUsageDaily_userId_clientId_grantKey_day_idx"
  ON "OAuthGrantUsageDaily"("userId", "clientId", "grantKey", "day");
CREATE INDEX "OAuthGrantUsageDaily_userId_clientId_lastUsedAt_idx"
  ON "OAuthGrantUsageDaily"("userId", "clientId", "lastUsedAt");

ALTER TABLE "OAuthGrantUsageDaily"
  ADD CONSTRAINT "OAuthGrantUsageDaily_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OAuthGrantUsageDaily"
  ADD CONSTRAINT "OAuthGrantUsageDaily_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId")
  ON DELETE CASCADE ON UPDATE CASCADE;

DO $runtime_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    GRANT SELECT ON TABLE "OAuthGrantUsageDaily" TO life_ustc_runtime;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_auth_runtime'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OAuthGrantUsageDaily"
      TO life_ustc_auth_runtime;
  END IF;
END
$runtime_grants$;
