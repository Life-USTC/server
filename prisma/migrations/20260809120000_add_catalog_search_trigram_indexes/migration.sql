CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY "Course_code_trgm_idx"
ON "Course" USING GIN ("code" gin_trgm_ops);

CREATE INDEX CONCURRENTLY "Course_nameCn_trgm_idx"
ON "Course" USING GIN ("nameCn" gin_trgm_ops);

CREATE INDEX CONCURRENTLY "Course_nameEn_trgm_idx"
ON "Course" USING GIN ("nameEn" gin_trgm_ops);

CREATE INDEX CONCURRENTLY "Section_code_trgm_idx"
ON "Section" USING GIN ("code" gin_trgm_ops);

CREATE INDEX CONCURRENTLY "Teacher_code_trgm_idx"
ON "Teacher" USING GIN ("code" gin_trgm_ops);

CREATE INDEX CONCURRENTLY "Teacher_nameCn_trgm_idx"
ON "Teacher" USING GIN ("nameCn" gin_trgm_ops);

CREATE INDEX CONCURRENTLY "Teacher_nameEn_trgm_idx"
ON "Teacher" USING GIN ("nameEn" gin_trgm_ops);
