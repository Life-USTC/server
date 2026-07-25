import { getOptionalTrimmedEnv } from "@/app-env";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  getCloudflareHyperdriveConnectionString,
  hasCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { localizedNamesExtension } from "@/lib/db/prisma-localized-names";
import { createBasePrisma, logPrismaQuery } from "@/lib/db/prisma-query-events";
import { shouldEnablePrismaQueryLogging } from "@/lib/db/prisma-query-logging";
import {
  getUserRlsTransactionClient,
  runWithUserRlsContext,
} from "@/lib/db/rls-context";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaQueryLoggerAttached: boolean | undefined;
};

let basePrisma: PrismaClient | undefined;

function createPrismaClient() {
  const client = createBasePrisma();
  if (!shouldEnablePrismaQueryLogging()) {
    return client;
  }

  if (!globalForPrisma.prismaQueryLoggerAttached) {
    (client as PrismaClient<"query">).$on("query", logPrismaQuery);
    globalForPrisma.prismaQueryLoggerAttached = true;
  }
  return client;
}

// Isolate-scope client cache for the Cloudflare runtime. Creating a
// PrismaClient (and its pg pool) costs significant CPU, so it must be reused
// across requests instead of being rebuilt inside the per-request runtime
// context. Keyed by connection string so a changed runtime env still gets a
// fresh client.
let cloudflareBasePrisma:
  | { client: PrismaClient; connectionString: string | undefined }
  | undefined;

function getCloudflareBasePrisma() {
  const connectionString = getCloudflareHyperdriveConnectionString();
  if (
    cloudflareBasePrisma &&
    cloudflareBasePrisma.connectionString === connectionString
  ) {
    return cloudflareBasePrisma.client;
  }

  const client = createPrismaClient();
  cloudflareBasePrisma = { client, connectionString };
  return client;
}

function getBasePrisma() {
  if (hasCloudflareRuntimeEnv()) {
    return getCloudflareBasePrisma();
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
    const client = getUserRlsTransactionClient() ?? getBasePrisma();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function withUserDbContext<T>(
  userId: string,
  action: (
    tx: import("@/generated/prisma/client").Prisma.TransactionClient,
  ) => Promise<T>,
) {
  return runWithUserRlsContext(getBasePrisma(), userId, action);
}

const _makeExtendedClient = (locale: string) =>
  prisma.$extends(localizedNamesExtension(locale));

type ExtendedPrismaClient = ReturnType<typeof _makeExtendedClient>;

const extendedClientCache = new Map<string, ExtendedPrismaClient>();
const cloudflareExtendedClientCache = new Map<string, ExtendedPrismaClient>();

export const getPrisma = (locale: string): ExtendedPrismaClient => {
  if (hasCloudflareRuntimeEnv()) {
    // Reuse extended clients across requests in the isolate; key by the
    // connection string as well so a changed runtime env cannot hand out a
    // client built on a stale base client.
    const cacheKey = `${getCloudflareHyperdriveConnectionString() ?? ""}:${locale}`;
    const cached = cloudflareExtendedClientCache.get(cacheKey);
    if (cached) return cached;
    const extended = _makeExtendedClient(locale);
    cloudflareExtendedClientCache.set(cacheKey, extended);
    return extended;
  }

  const cached = extendedClientCache.get(locale);
  if (cached) return cached;
  const extended = _makeExtendedClient(locale);
  extendedClientCache.set(locale, extended);
  return extended;
};
