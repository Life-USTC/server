CREATE TABLE "WeatherObservation" (
  "id" TEXT NOT NULL,
  "locationKey" TEXT NOT NULL,
  "observedAt" TIMESTAMP(0) NOT NULL,
  "providerBlobs" JSONB NOT NULL,
  "mergedSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WeatherObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeatherObservation_locationKey_observedAt_key"
  ON "WeatherObservation"("locationKey", "observedAt");
CREATE INDEX "WeatherObservation_locationKey_observedAt_idx"
  ON "WeatherObservation"("locationKey", "observedAt");
