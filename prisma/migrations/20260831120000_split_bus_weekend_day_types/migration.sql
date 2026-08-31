-- Replace the obsolete weekend enum with explicit Saturday/Sunday service days.
-- The type conversion keeps the old weekend rows as Sunday before dropping the
-- old enum type, so existing active schedules remain queryable throughout the
-- migration transaction.
ALTER TYPE "BusScheduleDayType" RENAME TO "BusScheduleDayType_old";

CREATE TYPE "BusScheduleDayType" AS ENUM ('weekday', 'saturday', 'sunday');

ALTER TABLE "BusTrip"
  ALTER COLUMN "dayType" TYPE "BusScheduleDayType"
  USING (
    CASE "dayType"::text
      WHEN 'weekend' THEN 'sunday'::"BusScheduleDayType"
      ELSE "dayType"::text::"BusScheduleDayType"
    END
  );

DROP TYPE "BusScheduleDayType_old";
