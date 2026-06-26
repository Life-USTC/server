export type AuditLogCleanupTarget = {
  targetType: string;
  targetId: number | string;
};

export type AuditLogCleanupTargetGroup = {
  targetType: string;
  targetIds: readonly (number | string)[];
};

export type AuditLogCleanupInput = {
  targets?: readonly AuditLogCleanupTarget[];
  userIds?: readonly string[];
};

export type GroupedAuditLogCleanupInput = {
  targets?: readonly AuditLogCleanupTargetGroup[];
  userIds?: readonly string[];
};

type AuditLogCleanupWhere = {
  OR: Array<
    | { targetId: { in: string[] }; targetType: string }
    | { userId: { in: string[] } }
  >;
};

type AuditLogCleanupPrisma = {
  auditLog: {
    count(args: { where: AuditLogCleanupWhere }): Promise<number>;
    deleteMany(args: {
      where: AuditLogCleanupWhere;
    }): Promise<{ count: number }>;
  };
};

type AuditLogCleanupRetryOptions = {
  attempts?: number;
  retryDelayMs?: number;
  stablePasses?: number;
};

const DEFAULT_AUDIT_CLEANUP_ATTEMPTS = 5;
const DEFAULT_AUDIT_CLEANUP_RETRY_DELAY_MS = 25;
const DEFAULT_AUDIT_CLEANUP_STABLE_PASSES = 2;

function uniqueNonEmptyStrings(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function waitForRetryDelay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flattenTargets(
  targets: readonly AuditLogCleanupTargetGroup[] | undefined,
): AuditLogCleanupTarget[] {
  return (targets ?? []).flatMap((target) =>
    target.targetIds.map((targetId) => ({
      targetId,
      targetType: target.targetType,
    })),
  );
}

export function buildAuditLogCleanupWhere(
  input: AuditLogCleanupInput,
): AuditLogCleanupWhere | null {
  const or: AuditLogCleanupWhere["OR"] = [];
  const userIds = uniqueNonEmptyStrings(input.userIds ?? []);
  if (userIds.length > 0) {
    or.push({ userId: { in: userIds } });
  }

  const targetIdsByType = new Map<string, string[]>();
  for (const target of input.targets ?? []) {
    const targetType = target.targetType.trim();
    if (!targetType) continue;

    const ids = targetIdsByType.get(targetType) ?? [];
    ids.push(String(target.targetId));
    targetIdsByType.set(targetType, ids);
  }

  for (const [targetType, targetIds] of targetIdsByType) {
    const uniqueTargetIds = uniqueNonEmptyStrings(targetIds);
    if (uniqueTargetIds.length > 0) {
      or.push({ targetId: { in: uniqueTargetIds }, targetType });
    }
  }

  return or.length > 0 ? { OR: or } : null;
}

export async function cleanupAuditLogs(
  prisma: AuditLogCleanupPrisma,
  input: AuditLogCleanupInput,
) {
  const where = buildAuditLogCleanupWhere(input);
  if (!where) return { count: 0 };
  return prisma.auditLog.deleteMany({ where });
}

export async function deleteAuditLogsForUsersAndTargets(
  prisma: AuditLogCleanupPrisma,
  input: GroupedAuditLogCleanupInput,
) {
  return cleanupAuditLogs(prisma, {
    targets: flattenTargets(input.targets),
    userIds: input.userIds,
  });
}

export async function cleanupAuditLogsUntilStable(
  prisma: AuditLogCleanupPrisma,
  input: AuditLogCleanupInput,
  options: AuditLogCleanupRetryOptions = {},
) {
  const where = buildAuditLogCleanupWhere(input);
  if (!where) return;

  const attempts = options.attempts ?? DEFAULT_AUDIT_CLEANUP_ATTEMPTS;
  const retryDelayMs =
    options.retryDelayMs ?? DEFAULT_AUDIT_CLEANUP_RETRY_DELAY_MS;
  const stablePasses =
    options.stablePasses ?? DEFAULT_AUDIT_CLEANUP_STABLE_PASSES;
  let emptyPasses = 0;
  let remaining = 0;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await prisma.auditLog.deleteMany({ where });
    remaining = await prisma.auditLog.count({ where });

    if (remaining === 0) {
      emptyPasses += 1;
      if (emptyPasses >= stablePasses) return;
    } else {
      emptyPasses = 0;
    }

    if (attempt < attempts) {
      await waitForRetryDelay(retryDelayMs);
    }
  }

  throw new Error(
    `Failed to clean audit logs after ${attempts} attempts; ${remaining} rows still match cleanup predicates`,
  );
}

export async function deleteAuditLogsForUsersAndTargetsUntilStable(
  prisma: AuditLogCleanupPrisma,
  input: GroupedAuditLogCleanupInput,
  options: AuditLogCleanupRetryOptions = {},
) {
  await cleanupAuditLogsUntilStable(
    prisma,
    {
      targets: flattenTargets(input.targets),
      userIds: input.userIds,
    },
    options,
  );
}
