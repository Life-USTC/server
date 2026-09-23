\set ON_ERROR_STOP on

-- Exercise the exact deployment grants and policies, with disposable credentials.
\set app_password 'runtime-test-password'
\set auth_password 'auth-runtime-test-password'
\set maintenance_password 'maintenance-runtime-test-password'
\ir ../../../prisma/roles/production-runtime-bootstrap.sql

-- Data fixtures are deliberately separate from the production role contract.
INSERT INTO "User" (id, email, "updatedAt")
VALUES
  (
    'rls-test-user-a',
    'rls-test-user-a@example.invalid',
    CURRENT_TIMESTAMP
  ),
  (
    'rls-test-user-b',
    'rls-test-user-b@example.invalid',
    CURRENT_TIMESTAMP
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  "updatedAt" = EXCLUDED."updatedAt";

WITH target_section AS (
  SELECT "id"
  FROM "Section"
  ORDER BY "id"
  LIMIT 1
)
INSERT INTO "Comment" (
  "id",
  "body",
  "visibility",
  "status",
  "updatedAt",
  "userId",
  "sectionId"
)
SELECT
  fixture."id",
  fixture."body",
  fixture."visibility"::"CommentVisibility",
  fixture."status"::"CommentStatus",
  CURRENT_TIMESTAMP,
  'rls-test-user-a',
  target_section."id"
FROM target_section
CROSS JOIN (
  VALUES
    (
      'rls-test-comment-public',
      'RLS public reaction fixture',
      'public',
      'active'
    ),
    (
      'rls-test-comment-logged-in',
      'RLS authenticated reaction fixture',
      'logged_in_only',
      'active'
    ),
    (
      'rls-test-comment-softbanned',
      'RLS softbanned reaction fixture',
      'public',
      'softbanned'
    ),
    (
      'rls-test-comment-deleted',
      'RLS deleted reaction fixture',
      'public',
      'deleted'
    )
) AS fixture("id", "body", "visibility", "status")
ON CONFLICT ("id") DO UPDATE SET
  "body" = EXCLUDED."body",
  "visibility" = EXCLUDED."visibility",
  "status" = EXCLUDED."status",
  "updatedAt" = EXCLUDED."updatedAt",
  "userId" = EXCLUDED."userId",
  "sectionId" = EXCLUDED."sectionId";

INSERT INTO "CommentReaction" ("id", "type", "commentId", "userId")
VALUES
  (
    'rls-test-reaction-logged-in',
    'heart',
    'rls-test-comment-logged-in',
    'rls-test-user-b'
  ),
  (
    'rls-test-reaction-softbanned',
    'heart',
    'rls-test-comment-softbanned',
    'rls-test-user-b'
  ),
  (
    'rls-test-reaction-deleted',
    'heart',
    'rls-test-comment-deleted',
    'rls-test-user-b'
  )
ON CONFLICT ("id") DO UPDATE SET
  "type" = EXCLUDED."type",
  "commentId" = EXCLUDED."commentId",
  "userId" = EXCLUDED."userId";
