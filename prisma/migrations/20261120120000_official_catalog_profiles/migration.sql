ALTER TABLE "Course" ADD COLUMN "officialProfile" JSONB;
ALTER TABLE "Section" ADD COLUMN "officialProfile" JSONB;

-- Existing deployments can already have the importer role; platform setup
-- installs the same narrow grant when it creates the role after migrations.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_importer') THEN
    GRANT SELECT ("jwId") ON TABLE "CourseAlias" TO life_ustc_importer;
  END IF;
END $$;
