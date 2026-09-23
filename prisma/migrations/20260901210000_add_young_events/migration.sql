-- CreateTable
CREATE TABLE "YoungEvent" (
    "id" SERIAL NOT NULL,
    "youngId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "department" TEXT,
    "organizer" TEXT,
    "status" TEXT,
    "registrationStatus" TEXT,
    "location" TEXT,
    "imageUrl" TEXT,
    "hours" DOUBLE PRECISION,
    "capacity" INTEGER,
    "appliedCount" INTEGER,
    "startAt" TIMESTAMP(0),
    "endAt" TIMESTAMP(0),
    "applyStartAt" TIMESTAMP(0),
    "applyEndAt" TIMESTAMP(0),
    "isActive" BOOLEAN NOT NULL,
    "rawJson" JSONB NOT NULL,

    CONSTRAINT "YoungEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoungEvent_youngId_key" ON "YoungEvent"("youngId");

-- CreateIndex
CREATE INDEX "YoungEvent_isActive_startAt_idx" ON "YoungEvent"("isActive", "startAt");

-- CreateIndex
CREATE INDEX "YoungEvent_category_idx" ON "YoungEvent"("category");
