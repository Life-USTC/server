import type { Prisma } from "../generated/prisma-node/client";

const GLOBAL_IMPORT_STATE_ID = "global";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

// Increment whenever mapper semantics change and existing imported rows must be
// rebuilt even when the source snapshot itself is unchanged.
export const STATIC_IMPORT_TRANSFORM_REVISION = 1;

type StaticImportStateTransaction = {
  staticImportState: Pick<
    Prisma.TransactionClient["staticImportState"],
    "findUnique" | "upsert"
  >;
};

type StaticImportStateInput = {
  observedAt: Date;
  snapshotSha256: string;
  transformRevision: number;
};

function validateSnapshotSha256(snapshotSha256: string) {
  if (!SHA256_PATTERN.test(snapshotSha256)) {
    throw new Error("Static snapshot SHA-256 must be 64 lowercase hex digits");
  }
}

function validateTransformRevision(transformRevision: number) {
  if (!Number.isSafeInteger(transformRevision) || transformRevision < 1) {
    throw new Error(
      "Static import transform revision must be a positive integer",
    );
  }
}

export async function assertStaticImportStateAllowsSnapshot(
  tx: StaticImportStateTransaction,
  input: StaticImportStateInput,
): Promise<boolean> {
  validateSnapshotSha256(input.snapshotSha256);
  validateTransformRevision(input.transformRevision);
  const current = await tx.staticImportState.findUnique({
    where: { id: GLOBAL_IMPORT_STATE_ID },
    select: {
      snapshotGeneratedAt: true,
      snapshotSha256: true,
      transformRevision: true,
    },
  });

  if (current == null) return false;

  if (input.transformRevision < current.transformRevision) {
    throw new Error(
      `Refusing static import transform revision ${input.transformRevision} because revision ${current.transformRevision} was already committed`,
    );
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
  return (
    input.snapshotSha256 === current.snapshotSha256 &&
    input.transformRevision === current.transformRevision
  );
}

export async function recordStaticImportState(
  tx: StaticImportStateTransaction,
  input: StaticImportStateInput,
) {
  validateSnapshotSha256(input.snapshotSha256);
  validateTransformRevision(input.transformRevision);
  await tx.staticImportState.upsert({
    where: { id: GLOBAL_IMPORT_STATE_ID },
    create: {
      id: GLOBAL_IMPORT_STATE_ID,
      snapshotGeneratedAt: input.observedAt,
      snapshotSha256: input.snapshotSha256,
      transformRevision: input.transformRevision,
    },
    update: {
      snapshotGeneratedAt: input.observedAt,
      snapshotSha256: input.snapshotSha256,
      transformRevision: input.transformRevision,
    },
  });
}
