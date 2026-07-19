import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma-node/client";
import { cleanupExpiredAuthRecords } from "./auth-record-cleanup";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await cleanupExpiredAuthRecords(prisma);
    console.log("Expired auth record cleanup completed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error("Expired auth record cleanup failed.");
  process.exitCode = 1;
});
