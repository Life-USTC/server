import type { Prisma } from "../generated/prisma-node/client";

const GLOBAL_IMPORT_STATE_ID = "global";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

type StaticImportStateTransaction = {
  staticImportState: Pick<
    Prisma.TransactionClient["staticImportState"],
    "findUnique" | "upsert"
  >;
};

type StaticImportStateInput = {
  bootstrapEnabled: boolean;
  dryRun: boolean;
  expectedSnapshotSha256: string | null;
  observedAt: Date;
  retirementEnabled: boolean;
  snapshotSha256: string;
};

function validateSnapshotSha256(snapshotSha256: string) {
  if (!SHA256_PATTERN.test(snapshotSha256)) {
    throw new Error("Static snapshot SHA-256 must be 64 lowercase hex digits");
  }
}

export async function assertStaticImportStateAllowsSnapshot(
  tx: StaticImportStateTransaction,
  input: StaticImportStateInput,
) {
  validateSnapshotSha256(input.snapshotSha256);
  const current = await tx.staticImportState.findUnique({
    where: { id: GLOBAL_IMPORT_STATE_ID },
    select: { snapshotGeneratedAt: true, snapshotSha256: true },
  });

  if (current == null) {
    if (!input.bootstrapEnabled) {
      throw new Error(
        "Static import state is not initialized; run an approved manual bootstrap before importing",
      );
    }
    if (input.retirementEnabled) {
      throw new Error(
        "Missing-Section retirement cannot run while bootstrapping static import state",
      );
    }
    if (!input.dryRun && input.expectedSnapshotSha256 == null) {
      throw new Error(
        "STATIC_LOADER_EXPECTED_SNAPSHOT_SHA256 is required for a committed static import state bootstrap",
      );
    }
    if (
      input.expectedSnapshotSha256 != null &&
      input.expectedSnapshotSha256 !== input.snapshotSha256
    ) {
      throw new Error(
        `Approved static snapshot SHA-256 ${input.expectedSnapshotSha256} does not match downloaded snapshot ${input.snapshotSha256}`,
      );
    }
    return;
  }

  const incomingTime = input.observedAt.getTime();
  const currentTime = current.snapshotGeneratedAt.getTime();
  if (incomingTime < currentTime) {
    throw new Error(
      `Refusing to import snapshot generated at ${input.observedAt.toISOString()} because the last committed snapshot was generated at ${current.snapshotGeneratedAt.toISOString()}`,
    );
  }
  if (
    incomingTime === currentTime &&
    input.snapshotSha256 !== current.snapshotSha256
  ) {
    throw new Error(
      `Refusing snapshot SHA-256 ${input.snapshotSha256} because generated_at ${input.observedAt.toISOString()} was already committed with SHA-256 ${current.snapshotSha256}`,
    );
  }
}

export async function recordStaticImportState(
  tx: StaticImportStateTransaction,
  input: Pick<StaticImportStateInput, "observedAt" | "snapshotSha256">,
) {
  validateSnapshotSha256(input.snapshotSha256);
  await tx.staticImportState.upsert({
    where: { id: GLOBAL_IMPORT_STATE_ID },
    create: {
      id: GLOBAL_IMPORT_STATE_ID,
      snapshotGeneratedAt: input.observedAt,
      snapshotSha256: input.snapshotSha256,
    },
    update: {
      snapshotGeneratedAt: input.observedAt,
      snapshotSha256: input.snapshotSha256,
    },
  });
}
