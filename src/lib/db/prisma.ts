import { getOptionalTrimmedEnv } from "@/app-env";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  getCloudflareRuntimeContext,
  hasCloudflareRuntimeEnv,
} from "@/lib/cloudflare/runtime-env";
import { localizedNamesExtension } from "@/lib/db/prisma-localized-names";
import { createBasePrisma, logPrismaQuery } from "@/lib/db/prisma-query-events";
import { shouldEnablePrismaQueryLogging } from "@/lib/db/prisma-query-logging";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaQueryLoggerAttached: boolean | undefined;
};

let basePrisma: PrismaClient | undefined;

const cloudflarePrismaCacheKey = Symbol("life-ustc.cloudflare.prisma");

type CloudflarePrismaCache = {
  base?: PrismaClient;
  extended: Map<string, unknown>;
  queryLoggerAttached?: boolean;
};

function getCloudflarePrismaCache() {
  const context = getCloudflareRuntimeContext();
  if (!context) return undefined;

  const cached = context.cache.get(cloudflarePrismaCacheKey) as
    | CloudflarePrismaCache
    | undefined;
  if (cached) return cached;

  const cache: CloudflarePrismaCache = { extended: new Map() };
  context.cache.set(cloudflarePrismaCacheKey, cache);
  return cache;
}

function createPrismaClient(cache?: CloudflarePrismaCache) {
  const client = createBasePrisma();
  if (!shouldEnablePrismaQueryLogging()) {
    return client;
  }

  if (cache) {
    if (!cache.queryLoggerAttached) {
      (client as PrismaClient<"query">).$on("query", logPrismaQuery);
      cache.queryLoggerAttached = true;
    }
    return client;
  }

  if (!globalForPrisma.prismaQueryLoggerAttached) {
    (client as PrismaClient<"query">).$on("query", logPrismaQuery);
    globalForPrisma.prismaQueryLoggerAttached = true;
  }
  return client;
}

function getBasePrisma() {
  if (hasCloudflareRuntimeEnv()) {
    const cache = getCloudflarePrismaCache();
    if (cache) {
      cache.base ??= createPrismaClient(cache);
      return cache.base;
    }

    return createPrismaClient();
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

export const getPrisma = (locale: string): ExtendedPrismaClient => {
  if (hasCloudflareRuntimeEnv()) {
    const cache = getCloudflarePrismaCache();
    if (cache) {
      const cached = cache.extended.get(locale) as
        | ExtendedPrismaClient
        | undefined;
      if (cached) return cached;
      const extended = _makeExtendedClient(locale);
      cache.extended.set(locale, extended);
      return extended;
    }

    return _makeExtendedClient(locale);
  }

  const cached = extendedClientCache.get(locale);
  if (cached) return cached;
  const extended = _makeExtendedClient(locale);
  extendedClientCache.set(locale, extended);
  return extended;
};
