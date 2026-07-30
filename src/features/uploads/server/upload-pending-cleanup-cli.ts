import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma-node/client";
import { cleanupStaleUploadPendingStorage } from "./upload-pending-cleanup";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const report = await cleanupStaleUploadPendingStorage(prisma);
    console.log(
      `Upload pending storage cleanup completed: ${JSON.stringify(report)}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error("Upload pending storage cleanup failed.");
  process.exitCode = 1;
});
