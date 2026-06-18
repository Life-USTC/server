import { getOptionalTrimmedEnv } from "@/app-env";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  getCloudflareHyperdriveConnectionString,
  hasCloudflareRuntimeEnv,
} from "@/lib/cloudflare/runtime-env";
import { localizedNamesExtension } from "@/lib/db/prisma-localized-names";
import { createBasePrisma, logPrismaQuery } from "@/lib/db/prisma-query-events";
import { shouldEnablePrismaQueryLogging } from "@/lib/db/prisma-query-logging";

const globalForPrisma = globalThis as unknown as {
  cloudflarePrismaByConnectionString: Map<string, PrismaClient> | undefined;
  prisma: PrismaClient | undefined;
  prismaQueryLoggerAttached: boolean | undefined;
};

let basePrisma: PrismaClient | undefined;

function getRuntimeConnectionString() {
  return (
    getCloudflareHyperdriveConnectionString() ??
    getOptionalTrimmedEnv("DATABASE_URL")
  );
}

function createPrismaClient(connectionString?: string) {
  const client = createBasePrisma(connectionString);
  if (
    shouldEnablePrismaQueryLogging() &&
    (hasCloudflareRuntimeEnv() || !globalForPrisma.prismaQueryLoggerAttached)
  ) {
    (client as PrismaClient<"query">).$on("query", logPrismaQuery);
    globalForPrisma.prismaQueryLoggerAttached = true;
  }
  return client;
}

function getCloudflarePrisma() {
  const connectionString = getRuntimeConnectionString();
  const cacheKey = connectionString ?? "__missing_database_url__";
  const cache = globalForPrisma.cloudflarePrismaByConnectionString ?? new Map();
  globalForPrisma.cloudflarePrismaByConnectionString = cache;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const client = createPrismaClient(connectionString);
  cache.set(cacheKey, client);
  return client;
}

function getBasePrisma() {
  if (hasCloudflareRuntimeEnv()) {
    return getCloudflarePrisma();
  }

  const cached = globalForPrisma.prisma ?? basePrisma;
  if (cached) {
    return cached;
  }

  const client = createPrismaClient();

  if (getOptionalTrimmedEnv("NODE_ENV") !== "production") {
    globalForPrisma.prisma = client;
  }
  basePrisma = client;

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getBasePrisma();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

const _makeExtendedClient = (locale: string) =>
  prisma.$extends(localizedNamesExtension(locale));

type ExtendedPrismaClient = ReturnType<typeof _makeExtendedClient>;

const extendedClientCache = new Map<string, ExtendedPrismaClient>();

function extendedClientCacheKey(locale: string) {
  if (!hasCloudflareRuntimeEnv()) return locale;
  return `cloudflare:${getRuntimeConnectionString() ?? "__missing_database_url__"}:${locale}`;
}

export const getPrisma = (locale: string): ExtendedPrismaClient => {
  const cacheKey = extendedClientCacheKey(locale);
  const cached = extendedClientCache.get(cacheKey);
  if (cached) return cached;
  const extended = _makeExtendedClient(locale);
  extendedClientCache.set(cacheKey, extended);
  return extended;
};
