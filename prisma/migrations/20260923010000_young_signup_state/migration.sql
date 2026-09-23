-- Keep the two upstream status dimensions distinct. The old
-- registrationStatus key was empty in every inspected source row.
ALTER TABLE "YoungEvent"
  DROP COLUMN "registrationStatus",
  ADD COLUMN "activityStatusCode" TEXT,
  ADD COLUMN "signupStatusCode" TEXT,
  ADD COLUMN "requiresSignup" BOOLEAN;

-- Existing imported rows already retain these values in rawJson. Populate
-- the new columns immediately; subsequent snapshots keep them current.
UPDATE "YoungEvent"
SET
  "activityStatusCode" = NULLIF("rawJson"->>'itemStatus', ''),
  "signupStatusCode" = NULLIF("rawJson"->>'applyStatus', ''),
  "requiresSignup" = CASE "rawJson"->>'needApply'
    WHEN '1' THEN true
    WHEN '0' THEN false
    ELSE NULL
  END;
