-- DropForeignKey
ALTER TABLE "OAuthAccessToken" DROP CONSTRAINT "OAuthAccessToken_clientId_fkey";

-- DropForeignKey
ALTER TABLE "OAuthCode" DROP CONSTRAINT "OAuthCode_clientId_fkey";

-- DropForeignKey
ALTER TABLE "OAuthCode" DROP CONSTRAINT "OAuthCode_userId_fkey";

-- DropForeignKey
ALTER TABLE "OAuthRefreshToken" DROP CONSTRAINT "OAuthRefreshToken_clientId_fkey";

-- DropIndex
DROP INDEX "OAuthAccessToken_token_idx";

-- DropIndex
DROP INDEX "OAuthRefreshToken_tokenHash_idx";

-- DropIndex
DROP INDEX "OAuthRefreshToken_tokenHash_key";

-- Legacy refresh tokens stored only tokenHash values. Plaintext provider tokens
-- cannot be reconstructed, so this migration explicitly revokes them before
-- adding the provider-owned non-null token column.
DELETE FROM "OAuthRefreshToken";

-- AlterTable
ALTER TABLE "OAuthAccessToken" DROP COLUMN "resource",
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "refreshId" TEXT,
ADD COLUMN     "sessionId" TEXT,
ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OAuthClient" ADD COLUMN     "contacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableEndSession" BOOLEAN,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "policy" TEXT,
ADD COLUMN     "postLogoutRedirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "public" BOOLEAN,
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "requirePKCE" BOOLEAN,
ADD COLUMN     "responseTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "skipConsent" BOOLEAN,
ADD COLUMN     "softwareId" TEXT,
ADD COLUMN     "softwareStatement" TEXT,
ADD COLUMN     "softwareVersion" TEXT,
ADD COLUMN     "subjectType" TEXT,
ADD COLUMN     "tos" TEXT,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "uri" TEXT,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "tokenEndpointAuthMethod" DROP NOT NULL,
ALTER COLUMN "tokenEndpointAuthMethod" DROP DEFAULT,
ALTER COLUMN "grantTypes" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "OAuthRefreshToken" DROP COLUMN "resource",
DROP COLUMN "tokenHash",
ADD COLUMN     "authTime" TIMESTAMP(3),
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "revoked" TIMESTAMP(3),
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "token" TEXT NOT NULL,
ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "VerificationToken" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "OAuthCode";

-- CreateTable
CREATE TABLE "OAuthConsent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT,
    "referenceId" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OAuthConsent_clientId_idx" ON "OAuthConsent"("clientId");

-- CreateIndex
CREATE INDEX "OAuthConsent_userId_idx" ON "OAuthConsent"("userId");

-- CreateIndex
CREATE INDEX "OAuthAccessToken_sessionId_idx" ON "OAuthAccessToken"("sessionId");

-- CreateIndex
CREATE INDEX "OAuthAccessToken_refreshId_idx" ON "OAuthAccessToken"("refreshId");

-- CreateIndex
CREATE INDEX "OAuthClient_userId_idx" ON "OAuthClient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthRefreshToken_token_key" ON "OAuthRefreshToken"("token");

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_sessionId_idx" ON "OAuthRefreshToken"("sessionId");

-- AddForeignKey
ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthRefreshToken" ADD CONSTRAINT "OAuthRefreshToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthRefreshToken" ADD CONSTRAINT "OAuthRefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccessToken" ADD CONSTRAINT "OAuthAccessToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccessToken" ADD CONSTRAINT "OAuthAccessToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccessToken" ADD CONSTRAINT "OAuthAccessToken_refreshId_fkey" FOREIGN KEY ("refreshId") REFERENCES "OAuthRefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
