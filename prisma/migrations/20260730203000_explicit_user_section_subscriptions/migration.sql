-- Replace implicit _UserCalendarSections with explicit UserSectionSubscription rows.

CREATE TABLE "UserSectionSubscription" (
    "userId" TEXT NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSectionSubscription_pkey" PRIMARY KEY ("userId","sectionId")
);

INSERT INTO "UserSectionSubscription" ("userId", "sectionId", "createdAt")
SELECT "B", "A", CURRENT_TIMESTAMP
FROM "_UserCalendarSections"
ON CONFLICT ("userId", "sectionId") DO NOTHING;

CREATE INDEX "UserSectionSubscription_sectionId_idx" ON "UserSectionSubscription"("sectionId");

ALTER TABLE "UserSectionSubscription" ADD CONSTRAINT "UserSectionSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSectionSubscription" ADD CONSTRAINT "UserSectionSubscription_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "_UserCalendarSections";
