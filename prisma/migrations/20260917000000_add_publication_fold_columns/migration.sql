-- Reprint-fold support for news/notice list views (issue #1068).
--
-- news.ustc.edu.cn republishes the same article under multiple section
-- canonical URLs, each a legitimate distinct Publication row (distinct
-- (sourceId, canonicalUrl)). To let read queries fold those reprints into
-- one row per (normalized title, published date) group without touching
-- crawler data, this migration adds two Postgres-generated (STORED) columns
-- derived purely from existing columns:
--
--   normalizedTitle: NFKC-normalized, invisible-character-stripped,
--     whitespace-collapsed, lowercased title. Must stay in lockstep with
--     normalizePublicationTitle() in
--     src/features/publications/lib/publication-title-normalization.ts.
--
--   publishedDateShanghai: COALESCE(publishedAt, firstSeenAt) bucketed to
--     its Asia/Shanghai calendar date. Publication timestamps are stored as
--     naive UTC (Prisma's `timestamp(3) without time zone`), so we first
--     reinterpret as UTC, then convert to Asia/Shanghai wall-clock time,
--     matching the existing pattern in
--     src/features/profile/server/user-profile-contributions.ts and the
--     get_public_profile_comment_contribution_days() SQL function.
--
-- Both are STORED generated columns (computed once per row by Postgres, not
-- recomputed per query), so a plain composite B-tree index over them serves
-- an equi-fold lookup / GROUP BY without any per-query expression index.
--
-- Backfill cost: ALTER TABLE ... ADD COLUMN ... GENERATED ALWAYS AS (...)
-- STORED rewrites the table once (a single pass computing both expressions
-- for all ~133k existing rows), which is acceptable for this table's size
-- and is a one-time migration cost, not a recurring query cost.
ALTER TABLE "Publication"
  ADD COLUMN "normalizedTitle" TEXT GENERATED ALWAYS AS (
    lower(
      btrim(
        regexp_replace(
          regexp_replace(
            normalize("title", NFKC),
            '[' || chr(8203) || chr(8204) || chr(8205) || chr(8288) || chr(65279) || chr(173) || ']',
            '',
            'g'
          ),
          '\s+', ' ', 'g'
        )
      )
    )
  ) STORED NOT NULL,
  ADD COLUMN "publishedDateShanghai" DATE GENERATED ALWAYS AS (
    ((COALESCE("publishedAt", "firstSeenAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai')::date
  ) STORED NOT NULL;

-- Serves the fold query's PARTITION BY / GROUP BY (normalizedTitle,
-- publishedDateShanghai) at ~133k-row scale: an index-only equality lookup
-- per group instead of a sequential scan + sort. See PR body for EXPLAIN
-- ANALYZE evidence.
CREATE INDEX CONCURRENTLY "Publication_normalizedTitle_publishedDateShanghai_idx"
ON "Publication" ("normalizedTitle", "publishedDateShanghai");
