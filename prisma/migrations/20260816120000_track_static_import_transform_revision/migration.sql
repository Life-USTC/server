ALTER TABLE "StaticImportState"
ADD COLUMN "transformRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "StaticImportState"
ALTER COLUMN "transformRevision" DROP DEFAULT;

ALTER TABLE "StaticImportState"
ADD CONSTRAINT "StaticImportState_transformRevision_check"
CHECK ("transformRevision" >= 0);
