import { getOptionalTrimmedEnv } from "@/app-env";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  getCloudflareRuntimeContext,
  hasCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { createBasePrisma, logPrismaQuery } from "@/lib/db/prisma-query-events";
import { shouldEnablePrismaQueryLogging } from "@/lib/db/prisma-query-logging";

const globalForAuthPrisma = globalThis as unknown as {
  authPrisma: PrismaClient | undefined;
};

const cloudflareAuthPrismaCacheKey = Symbol("life-ustc.cloudflare.auth-prisma");
let baseAuthPrisma: PrismaClient | undefined;

function createAuthPrismaClient() {
  const client = createBasePrisma(undefined, "auth");
  if (shouldEnablePrismaQueryLogging()) {
    (client as PrismaClient<"query">).$on("query", logPrismaQuery);
  }
  return client;
}

function getBaseAuthPrisma() {
  if (hasCloudflareRuntimeEnv()) {
    const cache = getCloudflareRuntimeContext()?.cache;
    if (cache) {
      const cached = cache.get(cloudflareAuthPrismaCacheKey) as
        | PrismaClient
        | undefined;
      if (cached) return cached;
      const client = createAuthPrismaClient();
      cache.set(cloudflareAuthPrismaCacheKey, client);
      return client;
    }

    return createAuthPrismaClient();
  }

  const cached = globalForAuthPrisma.authPrisma ?? baseAuthPrisma;
  if (cached) return cached;

  const client = createAuthPrismaClient();
  if (getOptionalTrimmedEnv("NODE_ENV") !== "production") {
    globalForAuthPrisma.authPrisma = client;
  }
  baseAuthPrisma = client;
  return client;
}

export const authPrisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getBaseAuthPrisma();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
