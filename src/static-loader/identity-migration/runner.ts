import type { Prisma, PrismaClient } from "../../generated/prisma-node/client";
import { acquireStaticImportLock } from "../import-lock";
import { readIdentityMigrationDatabase } from "./database-reader";
import {
  applyIdentityMigrationPlan,
  type IdentityMigrationApplyReport,
} from "./executor";
import { sha256File } from "./file-sha256";
import { buildIdentityMigrationPlan } from "./planner";
import { readIdentityMigrationSnapshot } from "./snapshot-reader";
import type { IdentityMigrationPlan } from "./types";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type IdentityMigrationRunConfig = {
  snapshotPath: string;
  expectedSnapshotSha256: string;
  dryRun: boolean;
  minSemester?: number;
};

export type IdentityMigrationRunReport = {
  mode: "dry-run" | "apply";
  outcome: "planned" | "committed" | "already-completed";
  plan: IdentityMigrationPlan;
  applied: IdentityMigrationApplyReport | null;
};

export class IdentityMigrationBlockedError extends Error {
  constructor(readonly plan: IdentityMigrationPlan) {
    super(
      `Identity migration blocked by ${plan.blockers.length} invariant violation(s)`,
    );
    this.name = "IdentityMigrationBlockedError";
  }
}

export type IdentityMigrationRunnerDependencies = {
  sha256File: typeof sha256File;
  readSnapshot: typeof readIdentityMigrationSnapshot;
  readDatabase: typeof readIdentityMigrationDatabase;
  acquireLock: typeof acquireStaticImportLock;
  applyPlan: typeof applyIdentityMigrationPlan;
};

const DEFAULT_DEPENDENCIES: IdentityMigrationRunnerDependencies = {
  sha256File,
  readSnapshot: readIdentityMigrationSnapshot,
  readDatabase: readIdentityMigrationDatabase,
  acquireLock: acquireStaticImportLock,
  applyPlan: applyIdentityMigrationPlan,
};

export async function runIdentityMigration(
  prisma: PrismaClient,
  config: IdentityMigrationRunConfig,
  dependencies: IdentityMigrationRunnerDependencies = DEFAULT_DEPENDENCIES,
): Promise<IdentityMigrationRunReport> {
  if (!SHA256_PATTERN.test(config.expectedSnapshotSha256)) {
    throw new Error(
      "Expected snapshot SHA-256 must be 64 lowercase hex digits",
    );
  }
  const fileSha256 = await dependencies.sha256File(config.snapshotPath);
  if (fileSha256 !== config.expectedSnapshotSha256) {
    throw new Error(
      `Expected snapshot SHA-256 ${config.expectedSnapshotSha256} does not match file SHA-256 ${fileSha256}`,
    );
  }
  const snapshot = dependencies.readSnapshot(
    config.snapshotPath,
    fileSha256,
    config.minSemester ?? 401,
  );

  return runSerializableWithRetry(prisma, async (tx) => {
    if (config.dryRun) {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    }
    await dependencies.acquireLock(tx);
    const database = await dependencies.readDatabase(
      tx,
      config.expectedSnapshotSha256,
    );
    const plan = buildIdentityMigrationPlan(snapshot, database);
    if (plan.mode === "already-completed") {
      return {
        mode: config.dryRun ? "dry-run" : "apply",
        outcome: "already-completed",
        plan,
        applied: null,
      };
    }
    if (plan.blockers.length > 0) throw new IdentityMigrationBlockedError(plan);
    if (config.dryRun) {
      return {
        mode: "dry-run",
        outcome: "planned",
        plan,
        applied: null,
      };
    }
    const applied = await dependencies.applyPlan(tx, plan, snapshot, database);
    return { mode: "apply", outcome: "committed", plan, applied };
  });
}

async function runSerializableWithRetry<T>(
  prisma: PrismaClient,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(action, {
        isolationLevel: "Serializable",
        maxWait: 60_000,
        timeout: 7_200_000,
      });
    } catch (error) {
      if (attempt < 3 && isSerializationError(error)) continue;
      throw error;
    }
  }
  throw new Error("Identity migration serialization retries exhausted");
}

function isSerializationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    cause?: unknown;
    code?: unknown;
    message?: unknown;
    name?: unknown;
  };
  if (candidate.code === "P2034") return true;
  if (
    candidate.name === "DriverAdapterError" &&
    typeof candidate.message === "string" &&
    candidate.message.includes("TransactionWriteConflict")
  ) {
    return true;
  }
  return isSerializationError(candidate.cause);
}
