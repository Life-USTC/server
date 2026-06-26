UPDATE "UserSuspension"
SET
  "liftedAt" = "expiresAt",
  "liftedById" = NULL
WHERE "liftedAt" IS NULL
  AND "expiresAt" IS NOT NULL
  AND "expiresAt" <= NOW();

WITH ranked_open_suspensions AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS "rank"
  FROM "UserSuspension"
  WHERE "liftedAt" IS NULL
)
UPDATE "UserSuspension"
SET
  "liftedAt" = NOW(),
  "liftedById" = NULL
FROM ranked_open_suspensions
WHERE "UserSuspension"."id" = ranked_open_suspensions."id"
  AND ranked_open_suspensions."rank" > 1;

CREATE UNIQUE INDEX "UserSuspension_one_open_per_user_key"
  ON "UserSuspension"("userId")
  WHERE "liftedAt" IS NULL;
