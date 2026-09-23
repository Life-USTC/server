import {
  type AuditLogCleanupInput,
  type AuditLogCleanupTarget,
  cleanupAuditLogsUntilStable,
} from "../../../shared/audit-cleanup";
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

export async function createAccountSecurityActivityFixture(userId: string) {
  return withE2ePrisma((prisma) =>
    prisma.auditLog.create({
      data: {
        action: "account_profile_update",
        channel: "web",
        outcome: "success",
        subjectUserId: userId,
        userId,
        ipAddress: "203.0.113.42",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
      },
      select: { id: true },
    }),
  );
}

export async function deleteAccountSecurityActivityFixture(id: string) {
  await withE2ePrisma((prisma) =>
    prisma.auditLog.deleteMany({ where: { id } }),
  );
}
