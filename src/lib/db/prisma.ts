import type { PrismaClient } from "@/generated/prisma/client";
import { localizedNamesExtension } from "@/lib/db/prisma-localized-names";
import { createBasePrisma, logPrismaQuery } from "@/lib/db/prisma-query-events";
import { shouldEnablePrismaQueryLogging } from "@/lib/db/prisma-query-logging";
import { getCloudflareHyperdriveConnectionString } from "@/lib/cloudflare/runtime-env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaQueryLoggerAttached: boolean | undefined;
};

let basePrisma: PrismaClient | undefined;

function isHyperdriveRuntime() {
  return Boolean(getCloudflareHyperdriveConnectionString());
}

function getBasePrisma() {
  if (isHyperdriveRuntime()) {
    return createBasePrisma();
  }

  const cached = globalForPrisma.prisma ?? basePrisma;
  if (cached) {
    return cached;
  }

  const client = createBasePrisma();
  if (
    shouldEnablePrismaQueryLogging() &&
    !globalForPrisma.prismaQueryLoggerAttached
  ) {
    (client as PrismaClient<"query">).$on("query", logPrismaQuery);
    globalForPrisma.prismaQueryLoggerAttached = true;
  }

  if (process.env.NODE_ENV !== "production") {
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
  if (isHyperdriveRuntime()) {
    return _makeExtendedClient(locale);
  }

  const cached = extendedClientCache.get(locale);
  if (cached) return cached;
  const extended = _makeExtendedClient(locale);
  extendedClientCache.set(locale, extended);
  return extended;
};
