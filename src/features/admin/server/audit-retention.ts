import { Prisma } from "@/generated/prisma/client";

export const AUDIT_RETENTION_BATCH_SIZE = 1000;
export const AUDIT_RETENTION_MAX_BATCHES = 20;
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
  auditRetentionBatches: number;
  auditRetentionComplete: boolean;
  attributionAnonymized: number;
  networkAnonymized: number;
  rowsDeleted: number;
};

export async function maintainOAuthGrantUsageRetention(
  prisma: AuditRetentionClient,
  now = new Date(),
  options: { maxBatches?: number } = {},
) {
  const maxBatches = Math.max(
    1,
    Math.trunc(options.maxBatches ?? AUDIT_RETENTION_MAX_BATCHES),
  );
  let batches = 0;
  let rowsDeleted = 0;
  let complete = false;
  while (batches < maxBatches) {
    const [result] = await prisma.$queryRaw<Array<{ rows_deleted: bigint }>>(
      Prisma.sql`
      SELECT public.maintain_oauth_grant_usage_retention(
        ${now},
        ${AUDIT_RETENTION_BATCH_SIZE}
      ) AS rows_deleted
    `,
    );
    const count = Number(result.rows_deleted);
    rowsDeleted += count;
    batches += 1;
    if (count < AUDIT_RETENTION_BATCH_SIZE) {
      complete = true;
      break;
    }
  }
  return {
    oauthRetentionBatches: batches,
    oauthRetentionComplete: complete,
    oauthUsageRowsDeleted: rowsDeleted,
  };
}

export async function maintainAuditLogRetention(
  prisma: AuditRetentionClient,
  now = new Date(),
  options: { maxBatches?: number } = {},
): Promise<AuditRetentionReport> {
  const maxBatches = Math.max(
    1,
    Math.trunc(options.maxBatches ?? AUDIT_RETENTION_MAX_BATCHES),
  );
  let batches = 0;
  let attributionAnonymized = 0;
  let networkAnonymized = 0;
  let rowsDeleted = 0;
  let complete = false;
  while (batches < maxBatches) {
    const [result] = await prisma.$queryRaw<AuditRetentionRow[]>(Prisma.sql`
      SELECT *
      FROM public.maintain_audit_log_retention(
        ${now},
        ${AUDIT_RETENTION_BATCH_SIZE}
      )
    `);
    const batchAttribution = Number(result.attribution_anonymized);
    const batchNetwork = Number(result.network_anonymized);
    const batchRowsDeleted = Number(result.rows_deleted);
    attributionAnonymized += batchAttribution;
    networkAnonymized += batchNetwork;
    rowsDeleted += batchRowsDeleted;
    batches += 1;
    if (
      batchAttribution < AUDIT_RETENTION_BATCH_SIZE &&
      batchNetwork < AUDIT_RETENTION_BATCH_SIZE &&
      batchRowsDeleted < AUDIT_RETENTION_BATCH_SIZE
    ) {
      complete = true;
      break;
    }
  }

  return {
    auditRetentionBatches: batches,
    auditRetentionComplete: complete,
    attributionAnonymized,
    networkAnonymized,
    rowsDeleted,
  };
}
