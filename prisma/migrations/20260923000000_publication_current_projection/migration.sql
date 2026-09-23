-- Current Publication rows retain only the fields used for discovery,
-- filtering, ordering, and relation to the immutable current revision.
-- Revision-specific metadata and article text remain on PublicationRevision.
ALTER TABLE "Publication"
  DROP COLUMN "author",
  DROP COLUMN "updatedAtSource",
  DROP COLUMN "category",
  DROP COLUMN "bodyText",
  DROP COLUMN "sourcePageUrl",
  DROP COLUMN "extractionMethod",
  DROP COLUMN "rawMetadata",
  DROP COLUMN "classifierVersion";
