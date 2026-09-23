import { getOptionalTrimmedEnv } from "@/app-env";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  getCloudflareRuntimeContext,
  hasCloudflareRuntimeEnv,
  registerCloudflareRuntimeCleanup,
} from "@/lib/adapters/cloudflare-runtime";
import { createBasePrisma, logPrismaQuery } from "@/lib/db/prisma-query-events";
import { shouldEnablePrismaQueryLogging } from "@/lib/db/prisma-query-logging";

const globalForMaintenancePrisma = globalThis as typeof globalThis & {
  maintenancePrisma: PrismaClient | undefined;
};

const cloudflareMaintenancePrismaCacheKey = Symbol(
  "life-ustc.cloudflare.maintenance-prisma",
);
let baseMaintenancePrisma: PrismaClient | undefined;

function createMaintenancePrismaClient() {
  const client = createBasePrisma(undefined, "maintenance");
  if (shouldEnablePrismaQueryLogging()) {
    (client as PrismaClient<"query">).$on("query", logPrismaQuery);
  }
  return client;
}

function getBaseMaintenancePrisma() {
  if (hasCloudflareRuntimeEnv()) {
    const cache = getCloudflareRuntimeContext()?.cache;
    if (cache) {
      const cached = cache.get(cloudflareMaintenancePrismaCacheKey) as
        | PrismaClient
        | undefined;
      if (cached) return cached;
      const client = createMaintenancePrismaClient();
      registerCloudflareRuntimeCleanup(() => client.$disconnect());
      cache.set(cloudflareMaintenancePrismaCacheKey, client);
      return client;
    }

    return createMaintenancePrismaClient();
  }

  const cached =
    globalForMaintenancePrisma.maintenancePrisma ?? baseMaintenancePrisma;
  if (cached) return cached;

  const client = createMaintenancePrismaClient();
  if (getOptionalTrimmedEnv("NODE_ENV") !== "production") {
    globalForMaintenancePrisma.maintenancePrisma = client;
  }
  baseMaintenancePrisma = client;
  return client;
}

export const maintenancePrisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getBaseMaintenancePrisma();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
