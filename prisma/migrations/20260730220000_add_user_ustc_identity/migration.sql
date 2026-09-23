CREATE TABLE "UserUstcIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "upstreamUid" TEXT NOT NULL,
    "gid" TEXT,
    "sno" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserUstcIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserUstcIdentity_userId_upstreamUid_key"
ON "UserUstcIdentity"("userId", "upstreamUid");

CREATE INDEX "UserUstcIdentity_userId_idx" ON "UserUstcIdentity"("userId");

ALTER TABLE "UserUstcIdentity"
ADD CONSTRAINT "UserUstcIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserUstcIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserUstcIdentity" FORCE ROW LEVEL SECURITY;

CREATE POLICY "UserUstcIdentity_owner_isolation" ON "UserUstcIdentity"
  FOR ALL
  USING ("userId" = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.user_id', true), ''));
