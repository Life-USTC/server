-- AlterTable
ALTER TABLE "OAuthRefreshToken" ADD COLUMN "resources" TEXT[] DEFAULT ARRAY[]::TEXT[];
