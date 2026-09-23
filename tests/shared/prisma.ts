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

/**
 * Create the elevated client used only to arrange and inspect integration
 * fixtures.  Keep this connection explicit: falling back to the application
 * URL would make tests pass with a superuser while production runs with an
 * RLS-protected runtime role.
 */
export function createFixturePrisma(omit?: Prisma.PrismaClientOptions["omit"]) {
  const databaseUrl = process.env.FUNCTION_OWNER_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "FUNCTION_OWNER_DATABASE_URL is required to initialize fixture Prisma",
    );
  }
  return createTestPrisma(databaseUrl, omit);
}

export async function disconnectTestPrisma(prisma: TestPrismaClient) {
  await prisma.$disconnect();
}
