import { Prisma } from "@/generated/prisma-node/client";

export const AUTH_RECORD_CLEANUP_BATCH_SIZE = 1000;

type AuthRecordCleanupClient = Pick<Prisma.TransactionClient, "$queryRaw">;

type AuthRecordCleanupRow = {
  sessions: bigint;
  verification_tokens: bigint;
  oauth_access_tokens: bigint;
  oauth_refresh_tokens: bigint;
  device_codes: bigint;
};

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
  const [result] = await prisma.$queryRaw<AuthRecordCleanupRow[]>(
    Prisma.sql`
      SELECT *
      FROM public.cleanup_expired_auth_records(
        ${cutoff},
        ${AUTH_RECORD_CLEANUP_BATCH_SIZE}
      )
    `,
  );

  return {
    sessions: Number(result.sessions),
    verificationTokens: Number(result.verification_tokens),
    oauthAccessTokens: Number(result.oauth_access_tokens),
    oauthRefreshTokens: Number(result.oauth_refresh_tokens),
    deviceCodes: Number(result.device_codes),
  };
}
