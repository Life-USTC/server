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
  observedAt: Date;
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
): Promise<boolean> {
  validateSnapshotSha256(input.snapshotSha256);
  const current = await tx.staticImportState.findUnique({
    where: { id: GLOBAL_IMPORT_STATE_ID },
    select: { snapshotGeneratedAt: true, snapshotSha256: true },
  });

  if (current == null) return false;

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
  return input.snapshotSha256 === current.snapshotSha256;
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
