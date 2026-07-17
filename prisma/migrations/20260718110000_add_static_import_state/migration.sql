CREATE TABLE "StaticImportState" (
  "id" TEXT NOT NULL,
  "snapshotGeneratedAt" TIMESTAMP(3) NOT NULL,
  "snapshotSha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaticImportState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaticImportState_snapshotSha256_check"
    CHECK ("snapshotSha256" ~ '^[0-9a-f]{64}$')
);
