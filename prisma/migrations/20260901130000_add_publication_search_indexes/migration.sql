CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY "Publication_canonicalUrl_trgm_idx"
ON "Publication" USING GIN ("canonicalUrl" gin_trgm_ops);

CREATE INDEX CONCURRENTLY "Publication_title_trgm_idx"
ON "Publication" USING GIN ("title" gin_trgm_ops);

CREATE INDEX CONCURRENTLY "Publication_summary_trgm_idx"
ON "Publication" USING GIN ("summary" gin_trgm_ops);
