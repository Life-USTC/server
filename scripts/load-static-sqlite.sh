#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

SNAPSHOT_PATH="${1:?Usage: load-static-sqlite.sh /path/to/life-ustc-static.sqlite}"
MIN_SEMESTER="${STATIC_LOADER_MIN_SEMESTER:-401}"
DRY_RUN="${STATIC_LOADER_DRY_RUN:-false}"

case "$MIN_SEMESTER" in
  "" | *[!0-9]*)
    echo "STATIC_LOADER_MIN_SEMESTER must be a positive integer" >&2
    exit 1
    ;;
esac

if [ ! -f "$SNAPSHOT_PATH" ]; then
  echo "Snapshot not found: $SNAPSHOT_PATH" >&2
  exit 1
fi

SCHEMA_VERSION="$(sqlite3 -readonly "$SNAPSHOT_PATH" "SELECT value FROM metadata WHERE key = 'schema_version'")"
if [ "$SCHEMA_VERSION" != "4" ]; then
  if [ "$DRY_RUN" = "true" ] || [ "$DRY_RUN" = "1" ]; then
    echo "Static snapshot schema version ${SCHEMA_VERSION:-unknown} is not supported for full import; dry-run validation only" >&2
    sqlite3 -readonly "$SNAPSHOT_PATH" "SELECT COUNT(*) FROM metadata" >/dev/null
    exit 0
  fi
  echo "Unsupported static snapshot schema version: ${SCHEMA_VERSION:-unknown}" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

COURSE_FILTER="FROM courses WHERE semester_id GLOB '[0-9]*' AND CAST(semester_id AS INTEGER) >= $MIN_SEMESTER"
COURSE_JOIN_FILTER="JOIN courses ON courses.id = source.course_id WHERE courses.semester_id GLOB '[0-9]*' AND CAST(courses.semester_id AS INTEGER) >= $MIN_SEMESTER"

sqlite3 -readonly -header -csv "$SNAPSHOT_PATH" \
  "SELECT id, name, start_date, end_date FROM semesters" \
  > "$WORK_DIR/semesters.csv"

sqlite3 -readonly -header -csv "$SNAPSHOT_PATH" \
  "SELECT code, name, COALESCE(name_en, '') AS name_en, COALESCE(parent_code, '') AS parent_code, COALESCE(is_college, '') AS is_college FROM departments" \
  > "$WORK_DIR/departments.csv"

sqlite3 -readonly -header -csv "$SNAPSHOT_PATH" \
  "SELECT id, semester_id, name, course_code, lesson_code, teacher_name, COALESCE(date_time_place_person_text, '') AS date_time_place_person_text, COALESCE(course_type, '') AS course_type, course_gradation, course_category, education_type, class_type, open_department, description, credit $COURSE_FILTER" \
  > "$WORK_DIR/courses.csv"

sqlite3 -readonly -header -csv "$SNAPSHOT_PATH" \
  "SELECT source.course_id, source.position, source.name, COALESCE(source.name_en, '') AS name_en, COALESCE(source.code, '') AS code, COALESCE(source.teacher_id, '') AS teacher_id, COALESCE(source.person_id, '') AS person_id, COALESCE(source.department, '') AS department, COALESCE(source.department_code, '') AS department_code, COALESCE(source.role, '') AS role, COALESCE(source.period, '') AS period, COALESCE(source.teacher_lesson_type, '') AS teacher_lesson_type, COALESCE(source.teacher_lesson_type_code, '') AS teacher_lesson_type_code, COALESCE(source.teacher_lesson_type_role, '') AS teacher_lesson_type_role, source.week_indices, COALESCE(source.week_indices_msg, '') AS week_indices_msg FROM course_teacher_assignments AS source $COURSE_JOIN_FILTER" \
  > "$WORK_DIR/teacher_assignments.csv"

sqlite3 -readonly -header -csv "$SNAPSHOT_PATH" \
  "SELECT source.course_id, source.position, source.start_date, source.end_date, source.name, source.location, source.teacher_name, source.periods, source.start_index, source.end_index, source.start_hhmm, source.end_hhmm FROM course_lectures AS source $COURSE_JOIN_FILTER" \
  > "$WORK_DIR/lectures.csv"

sqlite3 -readonly -header -csv "$SNAPSHOT_PATH" \
  "SELECT source.course_id, source.position, source.start_date, source.end_date, source.name, source.location, source.exam_type, source.start_hhmm, source.end_hhmm, COALESCE(source.exam_mode, '') AS exam_mode FROM course_exams AS source $COURSE_JOIN_FILTER" \
  > "$WORK_DIR/exams.csv"

TX_END="COMMIT"
if [ "$DRY_RUN" = "true" ] || [ "$DRY_RUN" = "1" ]; then
  TX_END="ROLLBACK"
fi

quote_sql_literal() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/''/g")"
}

SQL_FILE="$WORK_DIR/load.sql"
cat > "$SQL_FILE" <<'SQL'
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '20min';

CREATE FUNCTION pg_temp.static_numeric_id(ns text, val text)
RETURNS integer
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT (
    1500000000 + (
      get_byte(bytes, 0)::bigint * 16777216
      + get_byte(bytes, 1)::bigint * 65536
      + get_byte(bytes, 2)::bigint * 256
      + get_byte(bytes, 3)::bigint
    ) % 400000000
  )::integer
  FROM (SELECT decode(substr(md5(ns || ':' || val), 1, 8), 'hex') AS bytes) AS digest
$$;

CREATE TEMP TABLE static_semesters_stage (
  id text PRIMARY KEY,
  name text NOT NULL,
  start_date bigint NOT NULL,
  end_date bigint NOT NULL
);
\copy static_semesters_stage(id, name, start_date, end_date) FROM __SEMESTERS_CSV__ WITH (FORMAT csv, HEADER true)

CREATE TEMP TABLE static_departments_stage (
  code text PRIMARY KEY,
  name text NOT NULL,
  name_en text,
  parent_code text,
  is_college text
);
\copy static_departments_stage(code, name, name_en, parent_code, is_college) FROM __DEPARTMENTS_CSV__ WITH (FORMAT csv, HEADER true)

CREATE TEMP TABLE static_courses_stage (
  id integer PRIMARY KEY,
  semester_id text NOT NULL,
  name text NOT NULL,
  course_code text NOT NULL,
  lesson_code text NOT NULL,
  teacher_name text NOT NULL,
  date_time_place_person_text text,
  course_type text,
  course_gradation text NOT NULL,
  course_category text NOT NULL,
  education_type text NOT NULL,
  class_type text NOT NULL,
  open_department text NOT NULL,
  description text NOT NULL,
  credit double precision NOT NULL
);
\copy static_courses_stage(id, semester_id, name, course_code, lesson_code, teacher_name, date_time_place_person_text, course_type, course_gradation, course_category, education_type, class_type, open_department, description, credit) FROM __COURSES_CSV__ WITH (FORMAT csv, HEADER true)

CREATE TEMP TABLE static_teacher_assignments_stage (
  course_id integer NOT NULL,
  position integer NOT NULL,
  name text NOT NULL,
  name_en text,
  code text,
  teacher_id text,
  person_id text,
  department text,
  department_code text,
  role text,
  period text,
  teacher_lesson_type text,
  teacher_lesson_type_code text,
  teacher_lesson_type_role text,
  week_indices text NOT NULL,
  week_indices_msg text,
  PRIMARY KEY (course_id, position)
);
\copy static_teacher_assignments_stage(course_id, position, name, name_en, code, teacher_id, person_id, department, department_code, role, period, teacher_lesson_type, teacher_lesson_type_code, teacher_lesson_type_role, week_indices, week_indices_msg) FROM __TEACHER_ASSIGNMENTS_CSV__ WITH (FORMAT csv, HEADER true)

CREATE TEMP TABLE static_lectures_stage (
  course_id integer NOT NULL,
  position integer NOT NULL,
  start_date bigint NOT NULL,
  end_date bigint NOT NULL,
  name text NOT NULL,
  location text NOT NULL,
  teacher_name text NOT NULL,
  periods double precision NOT NULL,
  start_index integer NOT NULL,
  end_index integer NOT NULL,
  start_hhmm integer NOT NULL,
  end_hhmm integer NOT NULL,
  PRIMARY KEY (course_id, position)
);
\copy static_lectures_stage(course_id, position, start_date, end_date, name, location, teacher_name, periods, start_index, end_index, start_hhmm, end_hhmm) FROM __LECTURES_CSV__ WITH (FORMAT csv, HEADER true)

CREATE TEMP TABLE static_exams_stage (
  course_id integer NOT NULL,
  position integer NOT NULL,
  start_date bigint NOT NULL,
  end_date bigint NOT NULL,
  name text NOT NULL,
  location text NOT NULL,
  exam_type text NOT NULL,
  start_hhmm integer NOT NULL,
  end_hhmm integer NOT NULL,
  exam_mode text,
  PRIMARY KEY (course_id, position)
);
\copy static_exams_stage(course_id, position, start_date, end_date, name, location, exam_type, start_hhmm, end_hhmm, exam_mode) FROM __EXAMS_CSV__ WITH (FORMAT csv, HEADER true)

CREATE INDEX static_courses_semester_idx ON static_courses_stage(semester_id);
CREATE INDEX static_assignments_course_idx ON static_teacher_assignments_stage(course_id);
CREATE INDEX static_assignments_name_department_idx ON static_teacher_assignments_stage(name, department_code);
CREATE INDEX static_lectures_course_idx ON static_lectures_stage(course_id);
CREATE INDEX static_exams_course_idx ON static_exams_stage(course_id);

CREATE TEMP TABLE import_courses AS
SELECT *
FROM static_courses_stage
WHERE semester_id ~ '^[0-9]+$'
  AND semester_id::integer >= :min_semester;

CREATE INDEX import_courses_id_idx ON import_courses(id);
CREATE INDEX import_courses_code_idx ON import_courses(course_code);

INSERT INTO "Semester" ("jwId", "nameCn", code, "startDate", "endDate")
SELECT
  id::integer,
  name,
  id,
  ((to_timestamp(start_date) AT TIME ZONE 'Asia/Shanghai')::date),
  ((to_timestamp(end_date) AT TIME ZONE 'Asia/Shanghai')::date)
FROM static_semesters_stage
WHERE id ~ '^[0-9]+$'
ON CONFLICT ("jwId") DO UPDATE SET
  "nameCn" = EXCLUDED."nameCn",
  code = EXCLUDED.code,
  "startDate" = EXCLUDED."startDate",
  "endDate" = EXCLUDED."endDate";

CREATE TEMP TABLE import_departments_raw AS
SELECT
  0 AS priority,
  code,
  name,
  NULLIF(name_en, '') AS name_en,
  CASE NULLIF(is_college, '')
    WHEN '1' THEN true
    WHEN '0' THEN false
    ELSE NULL
  END AS is_college
FROM static_departments_stage
WHERE NULLIF(code, '') IS NOT NULL
UNION ALL
SELECT DISTINCT
  1 AS priority,
  NULLIF(department_code, '') AS code,
  '未知系别 ' || department_code AS name,
  NULL::text AS name_en,
  NULL::boolean AS is_college
FROM static_teacher_assignments_stage
WHERE NULLIF(department_code, '') IS NOT NULL;

CREATE TEMP TABLE import_departments AS
SELECT DISTINCT ON (code) code, name, name_en, is_college
FROM import_departments_raw
WHERE code IS NOT NULL
ORDER BY code, priority;

INSERT INTO "Department" (code, "nameCn", "nameEn", "isCollege")
SELECT code, name, name_en, is_college
FROM import_departments
ON CONFLICT (code) DO UPDATE SET
  "nameCn" = EXCLUDED."nameCn",
  "nameEn" = EXCLUDED."nameEn",
  "isCollege" = EXCLUDED."isCollege";

INSERT INTO "Department" (code, "nameCn", "isCollege")
SELECT
  'static-' || substr(md5(open_department), 1, 12),
  open_department,
  false
FROM (
  SELECT DISTINCT open_department
  FROM import_courses
  WHERE NULLIF(open_department, '') IS NOT NULL
) AS source
WHERE NOT EXISTS (
  SELECT 1 FROM "Department" existing WHERE existing."nameCn" = source.open_department
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "CourseType" ("nameCn")
SELECT DISTINCT NULLIF(course_type, '')
FROM import_courses
WHERE NULLIF(course_type, '') IS NOT NULL
ON CONFLICT ("nameCn") DO NOTHING;

INSERT INTO "CourseGradation" ("nameCn")
SELECT DISTINCT course_gradation
FROM import_courses
WHERE NULLIF(course_gradation, '') IS NOT NULL
ON CONFLICT ("nameCn") DO NOTHING;

INSERT INTO "CourseCategory" ("nameCn")
SELECT DISTINCT course_category
FROM import_courses
WHERE NULLIF(course_category, '') IS NOT NULL
ON CONFLICT ("nameCn") DO NOTHING;

INSERT INTO "EducationLevel" ("nameCn")
SELECT DISTINCT education_type
FROM import_courses
WHERE NULLIF(education_type, '') IS NOT NULL
ON CONFLICT ("nameCn") DO NOTHING;

INSERT INTO "ClassType" ("nameCn")
SELECT DISTINCT class_type
FROM import_courses
WHERE NULLIF(class_type, '') IS NOT NULL
ON CONFLICT ("nameCn") DO NOTHING;

CREATE TEMP TABLE import_course_variants AS
WITH variants AS (
  SELECT DISTINCT
    course_code,
    name,
    NULLIF(course_type, '') AS course_type,
    course_gradation,
    course_category,
    education_type,
    class_type
  FROM import_courses
), counted AS (
  SELECT
    variants.*,
    COUNT(*) OVER (PARTITION BY course_code) AS variant_count,
    concat_ws(
      E'\x1f',
      name,
      COALESCE(course_type, ''),
      course_gradation,
      course_category,
      education_type,
      class_type
    ) AS metadata_signature
  FROM variants
)
SELECT
  *,
  CASE
    WHEN variant_count = 1 THEN course_code
    ELSE course_code || ':' || md5(metadata_signature)
  END AS import_key
FROM counted;

CREATE UNIQUE INDEX import_course_variants_key_idx ON import_course_variants(import_key);

CREATE TEMP TABLE import_courses_with_key AS
SELECT import_courses.*, variants.import_key
FROM import_courses
JOIN import_course_variants variants ON
  variants.course_code = import_courses.course_code
  AND variants.name = import_courses.name
  AND variants.course_type IS NOT DISTINCT FROM NULLIF(import_courses.course_type, '')
  AND variants.course_gradation = import_courses.course_gradation
  AND variants.course_category = import_courses.course_category
  AND variants.education_type = import_courses.education_type
  AND variants.class_type = import_courses.class_type;

CREATE INDEX import_courses_with_key_id_idx ON import_courses_with_key(id);
CREATE INDEX import_courses_with_key_key_idx ON import_courses_with_key(import_key);

CREATE TEMP TABLE existing_course_code_counts AS
SELECT code, COUNT(*) AS row_count
FROM "Course"
GROUP BY code;

CREATE TEMP TABLE import_course_targets AS
SELECT
  variants.*,
  pg_temp.static_numeric_id('course', variants.import_key) AS generated_jw_id,
  COALESCE(exact_match."jwId", unique_code_match."jwId", pg_temp.static_numeric_id('course', variants.import_key)) AS target_jw_id,
  course_type_lookup.id AS type_id,
  gradation_lookup.id AS gradation_id,
  category_lookup.id AS category_id,
  education_lookup.id AS education_level_id,
  class_type_lookup.id AS class_type_id
FROM import_course_variants variants
LEFT JOIN "CourseType" course_type_lookup ON course_type_lookup."nameCn" = variants.course_type
LEFT JOIN "CourseGradation" gradation_lookup ON gradation_lookup."nameCn" = variants.course_gradation
LEFT JOIN "CourseCategory" category_lookup ON category_lookup."nameCn" = variants.course_category
LEFT JOIN "EducationLevel" education_lookup ON education_lookup."nameCn" = variants.education_type
LEFT JOIN "ClassType" class_type_lookup ON class_type_lookup."nameCn" = variants.class_type
LEFT JOIN LATERAL (
  SELECT course."jwId"
  FROM "Course" course
  LEFT JOIN "CourseType" current_type ON current_type.id = course."typeId"
  LEFT JOIN "CourseGradation" current_gradation ON current_gradation.id = course."gradationId"
  LEFT JOIN "CourseCategory" current_category ON current_category.id = course."categoryId"
  LEFT JOIN "EducationLevel" current_education ON current_education.id = course."educationLevelId"
  LEFT JOIN "ClassType" current_class_type ON current_class_type.id = course."classTypeId"
  WHERE course.code = variants.course_code
    AND course."nameCn" = variants.name
    AND current_type."nameCn" IS NOT DISTINCT FROM variants.course_type
    AND current_gradation."nameCn" IS NOT DISTINCT FROM variants.course_gradation
    AND current_category."nameCn" IS NOT DISTINCT FROM variants.course_category
    AND current_education."nameCn" IS NOT DISTINCT FROM variants.education_type
    AND current_class_type."nameCn" IS NOT DISTINCT FROM variants.class_type
  ORDER BY course.id
  LIMIT 1
) exact_match ON true
LEFT JOIN LATERAL (
  SELECT course."jwId"
  FROM "Course" course
  JOIN existing_course_code_counts counts ON counts.code = course.code
  WHERE variants.variant_count = 1
    AND course.code = variants.course_code
    AND counts.row_count = 1
  ORDER BY course.id
  LIMIT 1
) unique_code_match ON true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM import_course_targets
    GROUP BY target_jw_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Static course target jwId collision detected';
  END IF;
END $$;

INSERT INTO "Course" (
  "jwId",
  code,
  "nameCn",
  "nameEn",
  "categoryId",
  "classTypeId",
  "classifyId",
  "educationLevelId",
  "gradationId",
  "typeId"
)
SELECT
  target_jw_id,
  course_code,
  name,
  NULL,
  category_id,
  class_type_id,
  NULL,
  education_level_id,
  gradation_id,
  type_id
FROM import_course_targets
ON CONFLICT ("jwId") DO UPDATE SET
  code = EXCLUDED.code,
  "nameCn" = EXCLUDED."nameCn",
  "nameEn" = NULL,
  "categoryId" = EXCLUDED."categoryId",
  "classTypeId" = EXCLUDED."classTypeId",
  "classifyId" = EXCLUDED."classifyId",
  "educationLevelId" = EXCLUDED."educationLevelId",
  "gradationId" = EXCLUDED."gradationId",
  "typeId" = EXCLUDED."typeId";

CREATE TEMP TABLE import_course_target_ids AS
SELECT targets.import_key, course.id AS course_id, targets.target_jw_id
FROM import_course_targets targets
JOIN "Course" course ON course."jwId" = targets.target_jw_id;

CREATE TEMP TABLE import_section_rows AS
WITH lecture_totals AS (
  SELECT course_id, ROUND(SUM(periods))::integer AS total_periods, COUNT(*) AS lecture_count
  FROM static_lectures_stage
  GROUP BY course_id
), open_departments AS (
  SELECT "nameCn", MIN(id) AS id
  FROM "Department"
  GROUP BY "nameCn"
)
SELECT
  courses.id AS static_course_id,
  courses.semester_id,
  courses.lesson_code,
  courses.credit,
  courses.date_time_place_person_text,
  courses.description,
  course_ids.course_id,
  semester.id AS semester_record_id,
  open_departments.id AS open_department_id,
  lecture_totals.total_periods,
  COALESCE(lecture_totals.lecture_count, 0) AS lecture_count
FROM import_courses_with_key courses
JOIN import_course_target_ids course_ids ON course_ids.import_key = courses.import_key
JOIN "Semester" semester ON semester."jwId" = courses.semester_id::integer
LEFT JOIN lecture_totals ON lecture_totals.course_id = courses.id
LEFT JOIN open_departments ON open_departments."nameCn" = courses.open_department;

CREATE INDEX import_section_rows_static_id_idx ON import_section_rows(static_course_id);

INSERT INTO "Section" (
  "jwId",
  code,
  credits,
  period,
  "dateTimePlaceText",
  "dateTimePlacePersonText",
  "actualPeriods",
  "scheduleState",
  remark,
  "courseId",
  "semesterId",
  "openDepartmentId"
)
SELECT
  static_course_id,
  lesson_code,
  credit,
  total_periods,
  NULLIF(date_time_place_person_text, ''),
  CASE
    WHEN NULLIF(date_time_place_person_text, '') IS NULL THEN NULL
    ELSE to_jsonb(date_time_place_person_text)
  END,
  total_periods,
  CASE WHEN lecture_count > 0 THEN 'STATIC_IMPORTED' ELSE NULL END,
  NULLIF(description, ''),
  course_id,
  semester_record_id,
  open_department_id
FROM import_section_rows
ON CONFLICT ("jwId") DO UPDATE SET
  code = EXCLUDED.code,
  credits = EXCLUDED.credits,
  period = EXCLUDED.period,
  "dateTimePlaceText" = EXCLUDED."dateTimePlaceText",
  "dateTimePlacePersonText" = EXCLUDED."dateTimePlacePersonText",
  "actualPeriods" = EXCLUDED."actualPeriods",
  "scheduleState" = EXCLUDED."scheduleState",
  remark = EXCLUDED.remark,
  "courseId" = EXCLUDED."courseId",
  "semesterId" = EXCLUDED."semesterId",
  "openDepartmentId" = EXCLUDED."openDepartmentId";

CREATE TEMP TABLE import_sections AS
SELECT section_rows.static_course_id, section.id AS section_id
FROM import_section_rows section_rows
JOIN "Section" section ON section."jwId" = section_rows.static_course_id;

CREATE INDEX import_sections_static_course_idx ON import_sections(static_course_id);
CREATE INDEX import_sections_section_idx ON import_sections(section_id);

CREATE TEMP TABLE import_teacher_lesson_types AS
SELECT DISTINCT
  COALESCE(NULLIF(teacher_lesson_type_code, ''), NULLIF(teacher_lesson_type, '')) AS identity,
  COALESCE(NULLIF(teacher_lesson_type, ''), NULLIF(teacher_lesson_type_code, ''), 'Unknown') AS name_cn,
  NULLIF(teacher_lesson_type_code, '') AS code,
  NULLIF(teacher_lesson_type_role, '') AS role
FROM static_teacher_assignments_stage
WHERE NULLIF(teacher_lesson_type_code, '') IS NOT NULL
   OR NULLIF(teacher_lesson_type, '') IS NOT NULL;

INSERT INTO "TeacherLessonType" ("jwId", "nameCn", "nameEn", code, role, enabled)
SELECT
  pg_temp.static_numeric_id('teacher-lesson-type', identity),
  name_cn,
  NULL,
  COALESCE(code, identity),
  role,
  NULL
FROM import_teacher_lesson_types
ON CONFLICT ("jwId") DO UPDATE SET
  "nameCn" = EXCLUDED."nameCn",
  code = EXCLUDED.code,
  role = EXCLUDED.role;

CREATE TEMP TABLE import_assignment_rows AS
SELECT
  assignments.course_id,
  assignments.position,
  sections.section_id,
  assignments.name,
  NULLIF(assignments.name_en, '') AS name_en,
  NULLIF(assignments.code, '') AS teacher_code,
  NULLIF(assignments.teacher_id, '') AS teacher_id_text,
  NULLIF(assignments.person_id, '') AS person_id_text,
  NULLIF(assignments.department_code, '') AS department_code,
  department.id AS department_id,
  NULLIF(assignments.role, '') AS role,
  NULLIF(assignments.period, '') AS period_text,
  NULLIF(assignments.week_indices, '') AS week_indices,
  NULLIF(assignments.week_indices_msg, '') AS week_indices_msg,
  lesson_type.id AS teacher_lesson_type_id
FROM static_teacher_assignments_stage assignments
JOIN import_sections sections ON sections.static_course_id = assignments.course_id
LEFT JOIN "Department" department ON department.code = NULLIF(assignments.department_code, '')
LEFT JOIN "TeacherLessonType" lesson_type
  ON lesson_type."jwId" = pg_temp.static_numeric_id(
    'teacher-lesson-type',
    COALESCE(NULLIF(assignments.teacher_lesson_type_code, ''), NULLIF(assignments.teacher_lesson_type, ''))
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM import_assignment_rows
    WHERE department_code IS NOT NULL
      AND department_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Static teacher assignment references unknown department code';
  END IF;
END $$;

INSERT INTO "Teacher" (
  "personId",
  "teacherId",
  code,
  "nameCn",
  "nameEn",
  "departmentId"
)
SELECT DISTINCT ON (name, department_id)
  CASE WHEN person_id_text ~ '^[0-9]+$' THEN person_id_text::integer ELSE NULL END,
  CASE WHEN teacher_id_text ~ '^[0-9]+$' THEN teacher_id_text::integer ELSE NULL END,
  teacher_code,
  name,
  name_en,
  department_id
FROM import_assignment_rows
ORDER BY name, department_id, position
ON CONFLICT ("nameCn", "departmentId") DO UPDATE SET
  "nameEn" = COALESCE(EXCLUDED."nameEn", "Teacher"."nameEn");

CREATE TEMP TABLE import_section_teacher_pairs AS
SELECT DISTINCT rows.section_id, teacher.id AS teacher_id
FROM import_assignment_rows rows
JOIN "Teacher" teacher ON
  teacher."nameCn" = rows.name
  AND teacher."departmentId" IS NOT DISTINCT FROM rows.department_id;

CREATE UNIQUE INDEX import_section_teacher_pairs_idx ON import_section_teacher_pairs(section_id, teacher_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM import_assignment_rows rows
    WHERE NOT EXISTS (
      SELECT 1
      FROM import_section_teacher_pairs pairs
      JOIN "Teacher" teacher ON teacher.id = pairs.teacher_id
      WHERE pairs.section_id = rows.section_id
        AND teacher."nameCn" = rows.name
        AND teacher."departmentId" IS NOT DISTINCT FROM rows.department_id
    )
  ) THEN
    RAISE EXCEPTION 'Static teacher assignment could not be resolved to Teacher rows';
  END IF;
END $$;

DELETE FROM "_SectionTeachers" active
USING import_sections imported
WHERE active."A" = imported.section_id;

INSERT INTO "_SectionTeachers" ("A", "B")
SELECT section_id, teacher_id
FROM import_section_teacher_pairs
ON CONFLICT DO NOTHING;

UPDATE "SectionTeacher" section_teacher
SET
  "retiredAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
FROM import_sections imported
WHERE section_teacher."sectionId" = imported.section_id
  AND section_teacher."retiredAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM import_section_teacher_pairs current_pair
    WHERE current_pair.section_id = section_teacher."sectionId"
      AND current_pair.teacher_id = section_teacher."teacherId"
  );

INSERT INTO "SectionTeacher" ("sectionId", "teacherId", "retiredAt", "updatedAt")
SELECT section_id, teacher_id, NULL, CURRENT_TIMESTAMP
FROM import_section_teacher_pairs
ON CONFLICT ("sectionId", "teacherId") DO UPDATE SET
  "retiredAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

CREATE TEMP TABLE import_teacher_assignments AS
SELECT DISTINCT ON (rows.section_id, teacher.id)
  rows.section_id,
  teacher.id AS teacher_id,
  rows.role,
  CASE WHEN rows.period_text ~ '^[0-9]+(\.[0-9]+)?$' THEN ROUND(rows.period_text::numeric)::integer ELSE NULL END AS period,
  CASE WHEN rows.week_indices IS NULL THEN NULL ELSE rows.week_indices::jsonb END AS week_indices,
  rows.week_indices_msg,
  rows.teacher_lesson_type_id
FROM import_assignment_rows rows
JOIN "Teacher" teacher ON
  teacher."nameCn" = rows.name
  AND teacher."departmentId" IS NOT DISTINCT FROM rows.department_id
ORDER BY rows.section_id, teacher.id, rows.position;

DELETE FROM "TeacherAssignment" assignment
USING import_sections imported
WHERE assignment."sectionId" = imported.section_id;

INSERT INTO "TeacherAssignment" (
  "teacherId",
  "sectionId",
  role,
  period,
  "weekIndices",
  "weekIndicesMsg",
  "teacherLessonTypeId"
)
SELECT
  teacher_id,
  section_id,
  role,
  period,
  week_indices,
  week_indices_msg,
  teacher_lesson_type_id
FROM import_teacher_assignments;

DELETE FROM "_ScheduleTeachers" schedule_teacher
USING "Schedule" schedule, import_sections imported
WHERE schedule_teacher."A" = schedule.id
  AND schedule."sectionId" = imported.section_id;

DELETE FROM "Schedule" schedule
USING import_sections imported
WHERE schedule."sectionId" = imported.section_id;

DELETE FROM "ScheduleGroup" schedule_group
USING import_sections imported
WHERE schedule_group."sectionId" = imported.section_id;

DELETE FROM "ExamRoom" exam_room
USING "Exam" exam, import_sections imported
WHERE exam_room."examId" = exam.id
  AND exam."sectionId" = imported.section_id;

DELETE FROM "Exam" exam
USING import_sections imported
WHERE exam."sectionId" = imported.section_id;

CREATE TEMP TABLE import_schedule_groups AS
SELECT
  sections.static_course_id AS jw_id,
  sections.section_id,
  0 AS no,
  0 AS limit_count,
  0 AS std_count,
  COALESCE(ROUND(SUM(lectures.periods))::integer, 0) AS actual_periods,
  true AS is_default
FROM import_sections sections
JOIN static_lectures_stage lectures ON lectures.course_id = sections.static_course_id
GROUP BY sections.static_course_id, sections.section_id;

INSERT INTO "ScheduleGroup" ("jwId", "sectionId", no, "limitCount", "stdCount", "actualPeriods", "isDefault")
SELECT jw_id, section_id, no, limit_count, std_count, actual_periods, is_default
FROM import_schedule_groups
ON CONFLICT ("jwId") DO UPDATE SET
  "sectionId" = EXCLUDED."sectionId",
  no = EXCLUDED.no,
  "limitCount" = EXCLUDED."limitCount",
  "stdCount" = EXCLUDED."stdCount",
  "actualPeriods" = EXCLUDED."actualPeriods",
  "isDefault" = EXCLUDED."isDefault";

CREATE TEMP TABLE import_schedule_group_ids AS
SELECT groups.jw_id, schedule_group.id AS schedule_group_id
FROM import_schedule_groups groups
JOIN "ScheduleGroup" schedule_group ON schedule_group."jwId" = groups.jw_id;

CREATE TEMP TABLE import_schedule_source AS
SELECT
  ROW_NUMBER() OVER (ORDER BY lectures.course_id, lectures.position) AS import_id,
  sections.section_id,
  schedule_groups.schedule_group_id,
  GREATEST(ROUND(lectures.periods)::integer, 0) AS periods,
  ((to_timestamp(lectures.start_date) AT TIME ZONE 'Asia/Shanghai')::date) AS date,
  EXTRACT(ISODOW FROM (to_timestamp(lectures.start_date) AT TIME ZONE 'Asia/Shanghai'))::integer AS weekday,
  lectures.start_hhmm AS start_time,
  lectures.end_hhmm AS end_time,
  NULLIF(lectures.location, '') AS custom_place,
  (
    FLOOR(
      (
        ((to_timestamp(lectures.start_date) AT TIME ZONE 'Asia/Shanghai')::date)
        - ((to_timestamp(semesters.start_date) AT TIME ZONE 'Asia/Shanghai')::date)
      )::numeric / 7
    ) + 1
  )::integer AS week_index,
  false AS exercise_class,
  lectures.start_index AS start_unit,
  lectures.end_index AS end_unit,
  lectures.teacher_name,
  COALESCE(((to_timestamp(lectures.start_date) AT TIME ZONE 'Asia/Shanghai')::date)::text, '') AS date_key,
  COALESCE(NULLIF(lectures.location, ''), '') AS custom_place_key
FROM static_lectures_stage lectures
JOIN import_sections sections ON sections.static_course_id = lectures.course_id
JOIN import_schedule_group_ids schedule_groups ON schedule_groups.jw_id = lectures.course_id
JOIN import_courses courses ON courses.id = lectures.course_id
JOIN static_semesters_stage semesters ON semesters.id = courses.semester_id;

CREATE TEMP TABLE inserted_schedules AS
WITH inserted AS (
  INSERT INTO "Schedule" (
    periods,
    date,
    weekday,
    "startTime",
    "endTime",
    "customPlace",
    "weekIndex",
    "exerciseClass",
    "startUnit",
    "endUnit",
    "sectionId",
    "scheduleGroupId"
  )
  SELECT
    periods,
    date,
    weekday,
    start_time,
    end_time,
    custom_place,
    week_index,
    exercise_class,
    start_unit,
    end_unit,
    section_id,
    schedule_group_id
  FROM import_schedule_source
  ORDER BY import_id
  RETURNING
    id,
    "sectionId" AS section_id,
    "scheduleGroupId" AS schedule_group_id,
    periods,
    date,
    weekday,
    "startTime" AS start_time,
    "endTime" AS end_time,
    COALESCE("customPlace", '') AS custom_place_key,
    "weekIndex" AS week_index,
    "startUnit" AS start_unit,
    "endUnit" AS end_unit
)
SELECT *, COALESCE(date::text, '') AS date_key
FROM inserted;

CREATE TEMP TABLE schedule_id_by_import AS
WITH source_ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY section_id, schedule_group_id, periods, date_key, weekday, start_time, end_time, custom_place_key, week_index, start_unit, end_unit
      ORDER BY import_id
    ) AS duplicate_no
  FROM import_schedule_source
), inserted_ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY section_id, schedule_group_id, periods, date_key, weekday, start_time, end_time, custom_place_key, week_index, start_unit, end_unit
      ORDER BY id
    ) AS duplicate_no
  FROM inserted_schedules
)
SELECT source_ranked.import_id, inserted_ranked.id AS schedule_id
FROM source_ranked
JOIN inserted_ranked USING (
  section_id,
  schedule_group_id,
  periods,
  date_key,
  weekday,
  start_time,
  end_time,
  custom_place_key,
  week_index,
  start_unit,
  end_unit,
  duplicate_no
);

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM schedule_id_by_import) <> (SELECT COUNT(*) FROM import_schedule_source) THEN
    RAISE EXCEPTION 'Unable to map all imported schedule rows';
  END IF;
END $$;

CREATE TEMP TABLE import_schedule_teacher_names AS
SELECT
  schedules.import_id,
  schedules.section_id,
  BTRIM(name_part) AS teacher_name
FROM import_schedule_source schedules
CROSS JOIN regexp_split_to_table(schedules.teacher_name, '[,，]') AS name_part
WHERE NULLIF(BTRIM(name_part), '') IS NOT NULL;

INSERT INTO "_ScheduleTeachers" ("A", "B")
SELECT DISTINCT schedule_ids.schedule_id, pairs.teacher_id
FROM import_schedule_teacher_names names
JOIN schedule_id_by_import schedule_ids ON schedule_ids.import_id = names.import_id
JOIN import_section_teacher_pairs pairs ON pairs.section_id = names.section_id
JOIN "Teacher" teacher ON teacher.id = pairs.teacher_id AND teacher."nameCn" = names.teacher_name
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE import_exam_source AS
SELECT
  pg_temp.static_numeric_id('exam', exams.course_id::text || ':' || exams.position::text) AS jw_id,
  sections.section_id,
  CASE
    WHEN exams.exam_type LIKE '%期中%' THEN 1
    WHEN exams.exam_type LIKE '%期末%' THEN 2
    ELSE NULL
  END AS exam_type,
  exams.start_hhmm AS start_time,
  exams.end_hhmm AS end_time,
  ((to_timestamp(exams.start_date) AT TIME ZONE 'Asia/Shanghai')::date) AS exam_date,
  NULLIF(exams.exam_mode, '') AS exam_mode,
  exams.location
FROM static_exams_stage exams
JOIN import_sections sections ON sections.static_course_id = exams.course_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM import_exam_source
    GROUP BY jw_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Static exam jwId collision detected';
  END IF;
END $$;

CREATE TEMP TABLE inserted_exams AS
WITH inserted AS (
  INSERT INTO "Exam" (
    "jwId",
    "sectionId",
    "examType",
    "startTime",
    "endTime",
    "examDate",
    "examMode"
  )
  SELECT
    jw_id,
    section_id,
    exam_type,
    start_time,
    end_time,
    exam_date,
    exam_mode
  FROM import_exam_source
  RETURNING id, "jwId" AS jw_id
)
SELECT * FROM inserted;

INSERT INTO "ExamRoom" ("examId", room, count)
SELECT inserted_exams.id, BTRIM(room_part), 1
FROM import_exam_source source
JOIN inserted_exams ON inserted_exams.jw_id = source.jw_id
CROSS JOIN regexp_split_to_table(source.location, '[,，]') AS room_part
WHERE NULLIF(BTRIM(room_part), '') IS NOT NULL;

SELECT 'min_semester' AS metric, (:min_semester)::text AS value
UNION ALL SELECT 'staged_courses', COUNT(*)::text FROM import_courses
UNION ALL SELECT 'staged_assignments', COUNT(*)::text FROM static_teacher_assignments_stage
UNION ALL SELECT 'imported_sections', COUNT(*)::text FROM import_sections
UNION ALL SELECT 'imported_section_teacher_pairs', COUNT(*)::text FROM import_section_teacher_pairs
UNION ALL SELECT 'imported_teacher_assignments', COUNT(*)::text FROM import_teacher_assignments
UNION ALL SELECT 'imported_schedule_groups', COUNT(*)::text FROM import_schedule_groups
UNION ALL SELECT 'imported_schedules', COUNT(*)::text FROM inserted_schedules
UNION ALL SELECT 'imported_schedule_teacher_pairs', COUNT(*)::text FROM "_ScheduleTeachers" schedule_teacher
  JOIN schedule_id_by_import schedule_ids ON schedule_ids.schedule_id = schedule_teacher."A"
UNION ALL SELECT 'imported_exams', COUNT(*)::text FROM inserted_exams
UNION ALL SELECT 'transaction_end', :'tx_end';

:tx_end;
SQL

sed -i \
  -e "s#__SEMESTERS_CSV__#$(quote_sql_literal "$WORK_DIR/semesters.csv")#g" \
  -e "s#__DEPARTMENTS_CSV__#$(quote_sql_literal "$WORK_DIR/departments.csv")#g" \
  -e "s#__COURSES_CSV__#$(quote_sql_literal "$WORK_DIR/courses.csv")#g" \
  -e "s#__TEACHER_ASSIGNMENTS_CSV__#$(quote_sql_literal "$WORK_DIR/teacher_assignments.csv")#g" \
  -e "s#__LECTURES_CSV__#$(quote_sql_literal "$WORK_DIR/lectures.csv")#g" \
  -e "s#__EXAMS_CSV__#$(quote_sql_literal "$WORK_DIR/exams.csv")#g" \
  "$SQL_FILE"

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v min_semester="$MIN_SEMESTER" \
  -v tx_end="$TX_END" \
  -f "$SQL_FILE"
