import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma-node/client";

export type TestPrismaClient = PrismaClient;

export function createTestPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize Prisma");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    transactionOptions: {
      maxWait: 10_000,
      timeout: 60_000,
    },
  });
}

export async function disconnectTestPrisma(prisma: TestPrismaClient) {
  await prisma.$disconnect();
}
