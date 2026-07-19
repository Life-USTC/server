import { Prisma } from "@/generated/prisma-node/client";

export const AUTH_RECORD_CLEANUP_BATCH_SIZE = 1000;

type AuthRecordCleanupClient = Pick<Prisma.TransactionClient, "$executeRaw">;

export type AuthRecordCleanupReport = {
  sessions: number;
  verificationTokens: number;
  oauthAccessTokens: number;
  oauthRefreshTokens: number;
  deviceCodes: number;
};

export async function cleanupExpiredAuthRecords(
  prisma: AuthRecordCleanupClient,
  cutoff = new Date(),
): Promise<AuthRecordCleanupReport> {
  const oauthAccessTokens = await prisma.$executeRaw(
    Prisma.sql`
      WITH expired AS (
        SELECT "id"
        FROM "OAuthAccessToken"
        WHERE "expiresAt" < ${cutoff}
        ORDER BY "expiresAt", "id"
        LIMIT ${AUTH_RECORD_CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "OAuthAccessToken" AS target
      USING expired
      WHERE target."id" = expired."id"
    `,
  );
  const oauthRefreshTokens = await prisma.$executeRaw(
    Prisma.sql`
      WITH expired AS (
        SELECT "id"
        FROM "OAuthRefreshToken"
        WHERE "expiresAt" < ${cutoff}
        ORDER BY "expiresAt", "id"
        LIMIT ${AUTH_RECORD_CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "OAuthRefreshToken" AS target
      USING expired
      WHERE target."id" = expired."id"
    `,
  );
  const deviceCodes = await prisma.$executeRaw(
    Prisma.sql`
      WITH expired AS (
        SELECT "id"
        FROM "DeviceCode"
        WHERE "expiresAt" < ${cutoff}
        ORDER BY "expiresAt", "id"
        LIMIT ${AUTH_RECORD_CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "DeviceCode" AS target
      USING expired
      WHERE target."id" = expired."id"
    `,
  );
  const verificationTokens = await prisma.$executeRaw(
    Prisma.sql`
      WITH expired AS (
        SELECT "id"
        FROM "VerificationToken"
        WHERE "expires" < ${cutoff}
        ORDER BY "expires", "id"
        LIMIT ${AUTH_RECORD_CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "VerificationToken" AS target
      USING expired
      WHERE target."id" = expired."id"
    `,
  );
  const sessions = await prisma.$executeRaw(
    Prisma.sql`
      WITH expired AS (
        SELECT "id"
        FROM "Session"
        WHERE "expires" < ${cutoff}
        ORDER BY "expires", "id"
        LIMIT ${AUTH_RECORD_CLEANUP_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "Session" AS target
      USING expired
      WHERE target."id" = expired."id"
    `,
  );

  return {
    sessions,
    verificationTokens,
    oauthAccessTokens,
    oauthRefreshTokens,
    deviceCodes,
  };
}
