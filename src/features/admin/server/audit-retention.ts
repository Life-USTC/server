import { Prisma } from "@/generated/prisma/client";

export const AUDIT_RETENTION_BATCH_SIZE = 1000;
export const AUDIT_NETWORK_RETENTION_DAYS = 30;
export const AUDIT_ATTRIBUTION_RETENTION_DAYS = 90;
export const AUDIT_EVENT_RETENTION_DAYS = 400;

type AuditRetentionClient = Pick<Prisma.TransactionClient, "$queryRaw">;

type AuditRetentionRow = {
  attribution_anonymized: bigint;
  network_anonymized: bigint;
  rows_deleted: bigint;
};

export type AuditRetentionReport = {
  attributionAnonymized: number;
  networkAnonymized: number;
  rowsDeleted: number;
};

export async function maintainAuditLogRetention(
  prisma: AuditRetentionClient,
  now = new Date(),
): Promise<AuditRetentionReport> {
  const [result] = await prisma.$queryRaw<AuditRetentionRow[]>(Prisma.sql`
    SELECT *
    FROM public.maintain_audit_log_retention(
      ${now},
      ${AUDIT_RETENTION_BATCH_SIZE}
    )
  `);

  return {
    attributionAnonymized: Number(result.attribution_anonymized),
    networkAnonymized: Number(result.network_anonymized),
    rowsDeleted: Number(result.rows_deleted),
  };
}
