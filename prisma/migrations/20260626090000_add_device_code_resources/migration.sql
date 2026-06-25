-- AlterTable
ALTER TABLE "DeviceCode" ADD COLUMN "resources" TEXT[] DEFAULT ARRAY[]::TEXT[];
