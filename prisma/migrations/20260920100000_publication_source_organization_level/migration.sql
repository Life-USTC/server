-- Source registry modeling (issue #1069).
--
-- PublicationSource already existed and is already upserted from every
-- ingestion batch, but organizationLevel was a free-form TEXT column. The
-- source directory page groups by that value and the list filters on it, so
-- it needs a closed set: a free-form column cannot be grouped, ordered or
-- translated reliably, and a typo upstream silently creates a new "group".
--
-- The enum's declaration order is the directory's display order (Postgres
-- orders an enum by declaration order, so ORDER BY on this column sorts the
-- groups without a CASE expression).
--
-- `unknown` is deliberate: the crawler owns config/sources.yaml and may add a
-- level before this enum learns about it. Ingestion normalizes an unrecognized
-- level to `unknown` rather than rejecting the batch, so a new upstream level
-- degrades one grouping instead of stopping the crawl. It is also the value
-- the pre-existing ingestion path already wrote for a descriptor with no
-- organizationLevel, so no existing row changes meaning.
CREATE TYPE "PublicationSourceOrganizationLevel" AS ENUM (
  'university',
  'office',
  'department',
  'college',
  'center',
  'research',
  'service',
  'program',
  'society',
  'journal',
  'student',
  'unknown'
);

-- Existing rows carry the crawler's own vocabulary, which is already a subset
-- of the enum above (config/sources.yaml uses university/office/college/
-- center/research/service/program/society/journal/student) plus the 'unknown'
-- literal written for descriptors that omitted the field. Anything else is
-- mapped to 'unknown' so the migration cannot fail on unexpected data.
ALTER TABLE "PublicationSource"
  ALTER COLUMN "organizationLevel" TYPE "PublicationSourceOrganizationLevel"
  USING (
    CASE
      WHEN "organizationLevel" IN (
        'university', 'office', 'department', 'college', 'center',
        'research', 'service', 'program', 'society', 'journal', 'student'
      ) THEN "organizationLevel"::"PublicationSourceOrganizationLevel"
      ELSE 'unknown'::"PublicationSourceOrganizationLevel"
    END
  );

ALTER TABLE "PublicationSource"
  ALTER COLUMN "organizationLevel" SET DEFAULT 'unknown';
