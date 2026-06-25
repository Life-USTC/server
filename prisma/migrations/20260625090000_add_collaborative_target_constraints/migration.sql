DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Description"
    WHERE num_nonnulls("sectionId", "courseId", "teacherId", "homeworkId") <> 1
  ) THEN
    RAISE EXCEPTION 'Cannot add Description target constraint: every row must have exactly one target';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Comment"
    WHERE num_nonnulls("sectionId", "courseId", "teacherId", "sectionTeacherId", "homeworkId") <> 1
  ) THEN
    RAISE EXCEPTION 'Cannot add Comment target constraint: every row must have exactly one target';
  END IF;
END $$;

ALTER TABLE "Description"
  ADD CONSTRAINT "Description_exactly_one_target"
  CHECK (num_nonnulls("sectionId", "courseId", "teacherId", "homeworkId") = 1);

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_exactly_one_target"
  CHECK (num_nonnulls("sectionId", "courseId", "teacherId", "sectionTeacherId", "homeworkId") = 1);
