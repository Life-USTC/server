type PrismaQueryDebugMode = "off" | "standard" | "verbose";

const PRISMA_QUERY_DEBUG_ENABLED_VALUES = new Set(["1", "true", "yes"]);
const NON_NEGATIVE_INT_PATTERN = /^\d+$/;

export function getPrismaQueryDebugMode(
  input: NodeJS.ProcessEnv = process.env,
): PrismaQueryDebugMode {
  const value = input.PRISMA_QUERY_DEBUG?.trim().toLowerCase();
  if (value === "verbose") {
    return "verbose";
  }
  return value && PRISMA_QUERY_DEBUG_ENABLED_VALUES.has(value)
    ? "standard"
    : "off";
}

export function getPrismaSlowQueryThresholdMs(
  input: NodeJS.ProcessEnv = process.env,
) {
  const raw = input.PRISMA_SLOW_QUERY_MS?.trim();
  if (!raw || !NON_NEGATIVE_INT_PATTERN.test(raw)) return null;

  return Number(raw);
}

export function shouldEnablePrismaQueryLogging(
  input: NodeJS.ProcessEnv = process.env,
) {
  return (
    getPrismaQueryDebugMode(input) !== "off" ||
    getPrismaSlowQueryThresholdMs(input) != null
  );
}
