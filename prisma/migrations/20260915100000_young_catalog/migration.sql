-- Keep a local, stable organizer entity so imports can relate events without
-- treating the upstream display string as an identity.
CREATE TABLE "YoungOrganizer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YoungOrganizer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YoungOrganizer_normalizedName_key"
    ON "YoungOrganizer"("normalizedName");

ALTER TABLE "YoungEvent"
    ADD COLUMN "organizerId" TEXT,
    ADD COLUMN "sourceMissing" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "lastSeenAt" TIMESTAMP(3),
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing rows with deterministic IDs. New rows are created through
-- Prisma's cuid default; this backfill only needs to preserve identity across
-- repeated migration runs and does not expose the implementation format.
INSERT INTO "YoungOrganizer" ("id", "name", "normalizedName")
SELECT
    md5('young-organizer:' || normalized_name),
    min(btrim(regexp_replace(normalize("organizer", NFKC), '[[:space:]]+', ' ', 'g'))),
    normalized_name
FROM (
    SELECT
        "organizer",
        lower(btrim(regexp_replace(normalize("organizer", NFKC), '[[:space:]]+', ' ', 'g'))) AS normalized_name
    FROM "YoungEvent"
    WHERE "organizer" IS NOT NULL AND btrim("organizer") <> ''
) AS source
WHERE normalized_name <> ''
GROUP BY normalized_name;

UPDATE "YoungEvent" AS event
SET "organizerId" = organizer."id"
FROM "YoungOrganizer" AS organizer
WHERE event."organizer" IS NOT NULL
  AND lower(btrim(regexp_replace(normalize(event."organizer", NFKC), '[[:space:]]+', ' ', 'g'))) = organizer."normalizedName";

CREATE INDEX "YoungEvent_organizerId_startAt_idx"
    ON "YoungEvent"("organizerId", "startAt");
CREATE INDEX "YoungEvent_sourceMissing_startAt_idx"
    ON "YoungEvent"("sourceMissing", "startAt");

ALTER TABLE "YoungEvent"
    ADD CONSTRAINT "YoungEvent_organizerId_fkey"
    FOREIGN KEY ("organizerId") REFERENCES "YoungOrganizer"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
        EXECUTE 'GRANT SELECT ON TABLE "YoungOrganizer" TO life_ustc_runtime';
    END IF;
END
$$;
