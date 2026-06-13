import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma-node/client";

export type ToolPrismaClient = PrismaClient;

export function createToolPrisma() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    transactionOptions: {
      maxWait: 10_000,
      timeout: 60_000,
    },
  });
}

export async function disconnectToolPrisma(prisma: ToolPrismaClient) {
  await prisma.$disconnect();
}
