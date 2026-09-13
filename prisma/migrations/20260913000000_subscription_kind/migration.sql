CREATE TYPE "SubscriptionKind" AS ENUM ('regular', 'auditor', 'teaching_assistant');
ALTER TABLE "UserSectionSubscription" ADD COLUMN "kind" "SubscriptionKind" NOT NULL DEFAULT 'regular';
