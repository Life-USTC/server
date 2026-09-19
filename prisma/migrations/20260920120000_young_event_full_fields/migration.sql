-- Structure the high-value young.ustc.edu.cn fields that previously only
-- existed inside rawJson.
--
-- This migration is deliberately additive. The dead registrationStatus column
-- (empty for every one of the 2556 upstream records in the published snapshot)
-- stays in place; every interface now serializes it as null and documents it as
-- deprecated. Dropping the column is a breaking change for the generated Bot,
-- CLI, and iOS clients and belongs in its own approved migration.
ALTER TABLE "YoungEvent"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "participationNotes" TEXT,
    ADD COLUMN "activityLevel" TEXT,
    ADD COLUMN "module" TEXT,
    ADD COLUMN "form" TEXT,
    ADD COLUMN "grades" TEXT,
    ADD COLUMN "sponsor" TEXT,
    ADD COLUMN "contactName" TEXT,
    ADD COLUMN "contactTel" TEXT,
    ADD COLUMN "duration" DOUBLE PRECISION,
    ADD COLUMN "serviceHour" DOUBLE PRECISION,
    ADD COLUMN "sumHours" DOUBLE PRECISION,
    ADD COLUMN "sumPersons" INTEGER,
    ADD COLUMN "partakeNum" INTEGER,
    ADD COLUMN "favCount" INTEGER,
    ADD COLUMN "limitNum" INTEGER,
    ADD COLUMN "createdAtUpstream" TIMESTAMP(0),
    ADD COLUMN "auditedAt" TIMESTAMP(0),
    ADD COLUMN "updatedAtUpstream" TIMESTAMP(0),
    ADD COLUMN "places" JSONB;

-- 20260902150000_grant_young_event granted SELECT on the whole table, so the
-- new columns are already readable by life_ustc_runtime.
