import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  type Prisma,
  PrismaClient,
} from "../../src/generated/prisma-node/client";

export type TestPrismaClient = PrismaClient;

export function createTestPrisma(
  databaseUrl = process.env.DATABASE_URL,
  omit?: Prisma.PrismaClientOptions["omit"],
) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize Prisma");
  }

  const options: Prisma.PrismaClientOptions = {
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    transactionOptions: {
      maxWait: 10_000,
      timeout: 60_000,
    },
  };
  if (omit) options.omit = omit;
  return new PrismaClient(options);
}

export async function disconnectTestPrisma(prisma: TestPrismaClient) {
  await prisma.$disconnect();
}
