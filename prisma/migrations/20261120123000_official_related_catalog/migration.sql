-- CreateTable
CREATE TABLE "CourseSubstitutionRule" (
    "jwId" INTEGER NOT NULL,
    "originalCodes" TEXT[],
    "substituteCodes" TEXT[],
    "payload" JSONB NOT NULL,

    CONSTRAINT "CourseSubstitutionRule_pkey" PRIMARY KEY ("jwId")
);

-- CreateTable
CREATE TABLE "OfficialCourseGroupSource" (
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "OfficialCourseGroupSource_pkey" PRIMARY KEY ("sourceKind","sourceId")
);

-- CreateTable
CREATE TABLE "OfficialCourseGroupEntry" (
    "routeKey" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "routePosition" INTEGER NOT NULL,
    "sourcePosition" INTEGER NOT NULL,
    "nameCn" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "OfficialCourseGroupEntry_pkey" PRIMARY KEY ("routeKey","sourcePosition")
);

-- CreateTable
CREATE TABLE "OfficialCourseGroupPath" (
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "parentPath" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "groupKind" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "displayLabelCn" TEXT NOT NULL,

    CONSTRAINT "OfficialCourseGroupPath_pkey" PRIMARY KEY ("sourceKind","sourceId","path")
);

-- CreateTable
CREATE TABLE "OfficialCourseGroupMember" (
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,

    CONSTRAINT "OfficialCourseGroupMember_pkey" PRIMARY KEY ("sourceKind","sourceId","path","position")
);

-- CreateTable
CREATE TABLE "OfficialStudyPlanTree" (
    "id" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "OfficialStudyPlanTree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialStudyPlan" (
    "jwId" INTEGER NOT NULL,
    "departmentJwId" INTEGER NOT NULL,
    "majorJwId" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "trainType" TEXT,
    "publicModuleJwIds" INTEGER[],
    "summary" JSONB NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "OfficialStudyPlan_pkey" PRIMARY KEY ("jwId")
);

-- CreateTable
CREATE TABLE "OfficialStudyPlanModule" (
    "jwId" INTEGER NOT NULL,
    "publicModuleJwIds" INTEGER[],
    "payload" JSONB NOT NULL,

    CONSTRAINT "OfficialStudyPlanModule_pkey" PRIMARY KEY ("jwId")
);

-- CreateIndex
CREATE INDEX "CourseSubstitutionRule_originalCodes_idx" ON "CourseSubstitutionRule" USING GIN ("originalCodes");

-- CreateIndex
CREATE INDEX "CourseSubstitutionRule_substituteCodes_idx" ON "CourseSubstitutionRule" USING GIN ("substituteCodes");

-- CreateIndex
CREATE INDEX "OfficialCourseGroupEntry_sourceKind_sourceId_idx" ON "OfficialCourseGroupEntry"("sourceKind", "sourceId");

-- CreateIndex
CREATE INDEX "OfficialCourseGroupMember_courseCode_idx" ON "OfficialCourseGroupMember"("courseCode");

-- CreateIndex
CREATE INDEX "OfficialStudyPlan_departmentJwId_majorJwId_grade_idx" ON "OfficialStudyPlan"("departmentJwId", "majorJwId", "grade");

-- AddForeignKey
ALTER TABLE "OfficialCourseGroupEntry" ADD CONSTRAINT "OfficialCourseGroupEntry_sourceKind_sourceId_fkey" FOREIGN KEY ("sourceKind", "sourceId") REFERENCES "OfficialCourseGroupSource"("sourceKind", "sourceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialCourseGroupPath" ADD CONSTRAINT "OfficialCourseGroupPath_sourceKind_sourceId_fkey" FOREIGN KEY ("sourceKind", "sourceId") REFERENCES "OfficialCourseGroupSource"("sourceKind", "sourceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialCourseGroupMember" ADD CONSTRAINT "OfficialCourseGroupMember_sourceKind_sourceId_path_fkey" FOREIGN KEY ("sourceKind", "sourceId", "path") REFERENCES "OfficialCourseGroupPath"("sourceKind", "sourceId", "path") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OfficialRelatedCatalogState" (
    "source" TEXT NOT NULL,
    "digest" TEXT NOT NULL,

    CONSTRAINT "OfficialRelatedCatalogState_pkey" PRIMARY KEY ("source")
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_importer') THEN
    GRANT SELECT, INSERT, DELETE ON TABLE
      "CourseSubstitutionRule", "OfficialCourseGroupSource", "OfficialStudyPlan", "OfficialStudyPlanModule"
    TO life_ustc_importer;
    GRANT SELECT, INSERT ON TABLE
      "OfficialCourseGroupEntry", "OfficialCourseGroupPath", "OfficialCourseGroupMember"
    TO life_ustc_importer;
    GRANT SELECT, INSERT, UPDATE ON TABLE
      "OfficialStudyPlanTree", "OfficialRelatedCatalogState"
    TO life_ustc_importer;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    GRANT SELECT ON TABLE
      "CourseSubstitutionRule", "OfficialCourseGroupSource", "OfficialCourseGroupEntry", "OfficialCourseGroupPath", "OfficialCourseGroupMember", "OfficialStudyPlanTree", "OfficialStudyPlan", "OfficialStudyPlanModule"
    TO life_ustc_runtime;
  END IF;
END $$;
