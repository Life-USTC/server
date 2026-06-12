import type { PrismaClient } from "@/generated/prisma/client";
import { localizedNamesExtension } from "@/lib/db/prisma-localized-names";
import { createBasePrisma, logPrismaQuery } from "@/lib/db/prisma-query-events";
import { shouldEnablePrismaQueryLogging } from "@/lib/db/prisma-query-logging";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaQueryLoggerAttached: boolean | undefined;
};

const basePrisma: PrismaClient = globalForPrisma.prisma ?? createBasePrisma();
export const prisma = basePrisma;

if (
  shouldEnablePrismaQueryLogging() &&
  !globalForPrisma.prismaQueryLoggerAttached
) {
  (basePrisma as PrismaClient<"query">).$on("query", logPrismaQuery);
  globalForPrisma.prismaQueryLoggerAttached = true;
}

const _makeExtendedClient = (locale: string) =>
  prisma.$extends(localizedNamesExtension(locale));

type ExtendedPrismaClient = ReturnType<typeof _makeExtendedClient>;

const extendedClientCache = new Map<string, ExtendedPrismaClient>();

export const getPrisma = (locale: string): ExtendedPrismaClient => {
  const cached = extendedClientCache.get(locale);
  if (cached) return cached;
  const extended = _makeExtendedClient(locale);
  extendedClientCache.set(locale, extended);
  return extended;
};

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}
