ALTER TABLE "Course" ADD COLUMN "officialProfile" JSONB,
                     ADD COLUMN "officialCatalogOnly" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Section" ADD COLUMN "officialProfile" JSONB;

CREATE TABLE "OfficialCatalogRecord" (
  "source" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "courseCodes" TEXT[],
  "payload" JSONB NOT NULL,
  PRIMARY KEY ("source", "key")
);
CREATE INDEX "OfficialCatalogRecord_courseCodes_idx"
  ON "OfficialCatalogRecord" USING GIN ("courseCodes");

CREATE TABLE "OfficialCatalogState" (
  "source" TEXT PRIMARY KEY,
  "digest" TEXT NOT NULL
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_importer') THEN
    GRANT SELECT ("jwId") ON TABLE "CourseAlias" TO life_ustc_importer;
    GRANT SELECT, INSERT, DELETE ON TABLE "OfficialCatalogRecord" TO life_ustc_importer;
    GRANT SELECT, INSERT, UPDATE ON TABLE "OfficialCatalogState" TO life_ustc_importer;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    GRANT SELECT ON TABLE "OfficialCatalogRecord" TO life_ustc_runtime;
  END IF;
END $$;
