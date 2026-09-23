import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma-node/client";
import { createNodePgPoolConfig } from "../lib/db/node-pg-pool-config";

export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const adapter = new PrismaPg(createNodePgPoolConfig(connectionString));
  return new PrismaClient({ adapter });
}
