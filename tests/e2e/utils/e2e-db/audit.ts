import {
  type AuditLogCleanupInput,
  type AuditLogCleanupTarget,
  cleanupAuditLogsUntilStable,
} from "@tools/shared/audit-cleanup";
import { withE2ePrisma } from "./prisma";

export type { AuditLogCleanupTarget };

export async function cleanupAuditLogsForE2e(input: AuditLogCleanupInput) {
  await withE2ePrisma((prisma) => cleanupAuditLogsUntilStable(prisma, input));
}

export async function cleanupAuditTargetsForE2e(
  targets: readonly AuditLogCleanupTarget[],
) {
  await cleanupAuditLogsForE2e({ targets });
}
