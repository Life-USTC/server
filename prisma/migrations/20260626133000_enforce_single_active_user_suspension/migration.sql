WITH active_suspensions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "createdAt" DESC, id DESC
    ) AS active_rank
  FROM "UserSuspension"
  WHERE "liftedAt" IS NULL
)
UPDATE "UserSuspension" suspension
SET "liftedAt" = NOW()
FROM active_suspensions ranked
WHERE suspension.id = ranked.id
  AND ranked.active_rank > 1;

CREATE UNIQUE INDEX "UserSuspension_one_active_per_user_key"
  ON "UserSuspension"("userId")
  WHERE "liftedAt" IS NULL;
