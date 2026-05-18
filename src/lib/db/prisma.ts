import { format as formatLogArgs } from "node:util";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db/prisma-adapter";
import { shouldLog } from "@/lib/log/app-logger";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaQueryLoggerAttached: boolean | undefined;
};

const QUERY_LOG_TEXT_LIMIT = 2_000;

function getPrismaDebugValue() {
  return process.env.PRISMA_QUERY_DEBUG?.trim().toLowerCase();
}

function isPrismaQueryDebugEnabled() {
  const value = getPrismaDebugValue();
  return value === "1" || value === "true" || value === "yes";
}

function isPrismaQueryVerbose() {
  return getPrismaDebugValue() === "verbose";
}

function getPrismaSlowQueryThresholdMs() {
  const raw = process.env.PRISMA_SLOW_QUERY_MS?.trim();
  if (!raw) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function shouldEnablePrismaQueryLogging() {
  return (
    isPrismaQueryDebugEnabled() ||
    isPrismaQueryVerbose() ||
    getPrismaSlowQueryThresholdMs() != null
  );
}

function compactQueryText(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= QUERY_LOG_TEXT_LIMIT) return compact;
  return `${compact.slice(0, QUERY_LOG_TEXT_LIMIT)}...`;
}

function logPrismaQueryEvent(
  level: "info" | "warn",
  message: string,
  context: Record<string, unknown>,
) {
  if (!shouldLog(level)) return;

  const payload = {
    timestamp: formatShanghaiTimestamp(new Date()),
    environment: process.env.NODE_ENV ?? "development",
    runtime: typeof window === "undefined" ? "server" : "client",
    message,
    ...context,
  };

  if (process.env.NODE_ENV === "production") {
    process.stderr.write(
      `${JSON.stringify({ prefix: "[app]", ...payload })}\n`,
    );
    return;
  }

  process.stderr.write(`${formatLogArgs("[app]", payload)}\n`);
}

function logPrismaQuery(event: Prisma.QueryEvent) {
  const slowThresholdMs = getPrismaSlowQueryThresholdMs();
  const isSlow = slowThresholdMs != null && event.duration >= slowThresholdMs;

  if (!isSlow && !isPrismaQueryDebugEnabled() && !isPrismaQueryVerbose()) {
    return;
  }

  logPrismaQueryEvent(isSlow ? "warn" : "info", "Prisma query timing", {
    source: "prisma",
    event: isSlow ? "prisma.slow-query" : "prisma.query",
    durationMs: event.duration,
    target: event.target,
    query: compactQueryText(event.query),
    ...(isPrismaQueryVerbose()
      ? { params: compactQueryText(event.params) }
      : {}),
  });
}

function createBasePrisma() {
  const adapter = createPrismaAdapter();
  if (!shouldEnablePrismaQueryLogging()) {
    return new PrismaClient({ adapter });
  }

  return new PrismaClient({
    adapter,
    log: [{ emit: "event", level: "query" }],
  });
}

const normalizeName = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const getNamePrimary = (
  locale: string,
  nameCn: string,
  nameEn?: string | null,
) => {
  const english = normalizeName(nameEn);
  if (locale === "en-us" && english) {
    return english;
  }
  return nameCn;
};

const getNameSecondary = (
  locale: string,
  nameCn: string,
  nameEn?: string | null,
) => {
  const english = normalizeName(nameEn);
  if (locale === "en-us") {
    return english ? nameCn : null;
  }
  return english;
};

const localizedNameResult = (locale: string) => ({
  namePrimary: {
    needs: { nameCn: true, nameEn: true },
    compute: ({ nameCn, nameEn }: { nameCn: string; nameEn?: string | null }) =>
      getNamePrimary(locale, nameCn, nameEn),
  },
  nameSecondary: {
    needs: { nameCn: true, nameEn: true },
    compute: ({ nameCn, nameEn }: { nameCn: string; nameEn?: string | null }) =>
      getNameSecondary(locale, nameCn, nameEn),
  },
});

const localizedNamesExtension = (locale: string) =>
  Prisma.defineExtension({
    name: "localizedNames",
    result: {
      adminClass: localizedNameResult(locale),
      busCampus: localizedNameResult(locale),
      busRoute: localizedNameResult(locale),
      building: localizedNameResult(locale),
      campus: localizedNameResult(locale),
      classType: localizedNameResult(locale),
      course: localizedNameResult(locale),
      courseCategory: localizedNameResult(locale),
      courseClassify: localizedNameResult(locale),
      courseGradation: localizedNameResult(locale),
      courseType: localizedNameResult(locale),
      department: localizedNameResult(locale),
      educationLevel: localizedNameResult(locale),
      examBatch: localizedNameResult(locale),
      examMode: localizedNameResult(locale),
      room: localizedNameResult(locale),
      roomType: localizedNameResult(locale),
      teacher: localizedNameResult(locale),
      teacherLessonType: localizedNameResult(locale),
      teacherTitle: localizedNameResult(locale),
      teachLanguage: localizedNameResult(locale),
    },
  });

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
