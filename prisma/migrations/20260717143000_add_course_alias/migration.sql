CREATE TABLE "CourseAlias" (
  "jwId" INTEGER NOT NULL,
  "courseId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CourseAlias_pkey" PRIMARY KEY ("jwId")
);

CREATE INDEX "CourseAlias_courseId_idx" ON "CourseAlias"("courseId");

ALTER TABLE "CourseAlias"
  ADD CONSTRAINT "CourseAlias_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
