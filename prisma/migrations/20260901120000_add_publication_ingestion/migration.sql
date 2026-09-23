-- CreateEnum
CREATE TYPE "PublicationType" AS ENUM ('news', 'notice', 'other');

-- CreateEnum
CREATE TYPE "PublicationObjectKind" AS ENUM ('body_html', 'body_markdown', 'media', 'asset', 'raw_page');

-- CreateEnum
CREATE TYPE "PublicationObjectStatus" AS ENUM ('pending', 'uploaded', 'verified', 'linked', 'failed');

-- CreateEnum
CREATE TYPE "IngestionBatchStatus" AS ENUM ('accepted', 'rejected');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "PublicationSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationLevel" TEXT NOT NULL,
    "allowedHosts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedHosts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seedUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discoveryOnly" BOOLEAN NOT NULL DEFAULT false,
    "maxImagesPerPage" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "updatedAtSource" TIMESTAMP(3),
    "category" TEXT,
    "summary" TEXT,
    "bodyText" TEXT,
    "sourcePageUrl" TEXT,
    "extractionMethod" TEXT,
    "rawMetadata" JSONB,
    "publicationType" "PublicationType" NOT NULL,
    "classifierVersion" TEXT,
    "currentRevisionId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationRevision" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "revisionHash" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "isTombstone" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "updatedAtSource" TIMESTAMP(3),
    "category" TEXT,
    "summary" TEXT,
    "bodyText" TEXT,
    "sourcePageUrl" TEXT,
    "extractionMethod" TEXT,
    "rawMetadata" JSONB,
    "publicationType" "PublicationType" NOT NULL,
    "classifierVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationObject" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "kind" "PublicationObjectKind" NOT NULL,
    "size" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "status" "PublicationObjectStatus" NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationObjectLink" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "role" "PublicationObjectKind" NOT NULL,
    "sortOrder" INTEGER,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationObjectLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "clientRunId" TEXT NOT NULL,
    "principalId" TEXT,
    "principalKey" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'running',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionBatch" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "principalId" TEXT,
    "principalKey" TEXT NOT NULL,
    "payloadDigest" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "status" "IngestionBatchStatus" NOT NULL DEFAULT 'accepted',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionBatchObject" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "expectedSha256" TEXT NOT NULL,
    "expectedSize" INTEGER NOT NULL,
    "expectedContentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionBatchObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationEventOutbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationEventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- CreateIndex
CREATE INDEX "PublicationSource_enabled_idx" ON "PublicationSource"("enabled");
CREATE INDEX "PublicationSource_organizationLevel_idx" ON "PublicationSource"("organizationLevel");
CREATE UNIQUE INDEX "Publication_currentRevisionId_key" ON "Publication"("currentRevisionId");
CREATE INDEX "Publication_publicationType_publishedAt_idx" ON "Publication"("publicationType", "publishedAt");
CREATE INDEX "Publication_sourceId_lastSeenAt_idx" ON "Publication"("sourceId", "lastSeenAt");
CREATE INDEX "Publication_deletedAt_idx" ON "Publication"("deletedAt");
CREATE INDEX "Publication_currentRevisionId_idx" ON "Publication"("currentRevisionId");
CREATE UNIQUE INDEX "Publication_sourceId_canonicalUrl_key" ON "Publication"("sourceId", "canonicalUrl");
CREATE INDEX "PublicationRevision_publicationId_observedAt_idx" ON "PublicationRevision"("publicationId", "observedAt");
CREATE INDEX "PublicationRevision_revisionHash_idx" ON "PublicationRevision"("revisionHash");
CREATE UNIQUE INDEX "PublicationRevision_publicationId_revisionHash_key" ON "PublicationRevision"("publicationId", "revisionHash");
CREATE UNIQUE INDEX "PublicationObject_kind_sha256_key" ON "PublicationObject"("kind", "sha256");
CREATE UNIQUE INDEX "PublicationObject_r2Key_key" ON "PublicationObject"("r2Key");
CREATE INDEX "PublicationObject_status_updatedAt_idx" ON "PublicationObject"("status", "updatedAt");
CREATE INDEX "PublicationObjectLink_revisionId_role_idx" ON "PublicationObjectLink"("revisionId", "role");
CREATE UNIQUE INDEX "PublicationObjectLink_revisionId_objectId_role_key" ON "PublicationObjectLink"("revisionId", "objectId", "role");
CREATE UNIQUE INDEX "IngestionRun_principalKey_clientRunId_key" ON "IngestionRun"("principalKey", "clientRunId");
CREATE INDEX "IngestionRun_principalId_createdAt_idx" ON "IngestionRun"("principalId", "createdAt");
CREATE INDEX "IngestionRun_status_updatedAt_idx" ON "IngestionRun"("status", "updatedAt");
CREATE UNIQUE INDEX "IngestionBatch_principalKey_batchId_key" ON "IngestionBatch"("principalKey", "batchId");
CREATE INDEX "IngestionBatch_principalId_createdAt_idx" ON "IngestionBatch"("principalId", "createdAt");
CREATE INDEX "IngestionBatch_runId_idx" ON "IngestionBatch"("runId");
CREATE INDEX "IngestionBatchObject_objectId_idx" ON "IngestionBatchObject"("objectId");
CREATE UNIQUE INDEX "IngestionBatchObject_batchId_objectId_key" ON "IngestionBatchObject"("batchId", "objectId");
CREATE UNIQUE INDEX "PublicationEventOutbox_eventId_key" ON "PublicationEventOutbox"("eventId");
CREATE INDEX "PublicationEventOutbox_publishedAt_availableAt_idx" ON "PublicationEventOutbox"("publishedAt", "availableAt");
CREATE INDEX "PublicationEventOutbox_aggregateType_aggregateId_idx" ON "PublicationEventOutbox"("aggregateType", "aggregateId");
-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PublicationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "PublicationRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublicationRevision" ADD CONSTRAINT "PublicationRevision_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationObjectLink" ADD CONSTRAINT "PublicationObjectLink_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "PublicationRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationObjectLink" ADD CONSTRAINT "PublicationObjectLink_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "PublicationObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IngestionBatch" ADD CONSTRAINT "IngestionBatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IngestionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IngestionBatch" ADD CONSTRAINT "IngestionBatch_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IngestionBatchObject" ADD CONSTRAINT "IngestionBatchObject_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngestionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IngestionBatchObject" ADD CONSTRAINT "IngestionBatchObject_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "PublicationObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Publication ingestion is an application-admin operation. Keep these
-- tables out of ordinary user RLS writes; the app runtime role is granted
-- access explicitly and the feature still checks the authenticated admin.
DO $publication_ingestion_security$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE
      public."PublicationSource", public."Publication", public."PublicationRevision",
      public."PublicationObject", public."PublicationObjectLink", public."IngestionRun",
      public."IngestionBatch", public."IngestionBatchObject", public."PublicationEventOutbox"
      TO life_ustc_runtime';
    FOREACH table_name IN ARRAY ARRAY[
      'PublicationSource', 'Publication', 'PublicationRevision',
      'PublicationObject', 'PublicationObjectLink', 'IngestionRun',
      'IngestionBatch', 'IngestionBatchObject', 'PublicationEventOutbox'
    ]
    LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO life_ustc_runtime USING (true) WITH CHECK (true)',
        table_name || '_runtime_access', table_name
      );
    END LOOP;
  END IF;
END
$publication_ingestion_security$;
