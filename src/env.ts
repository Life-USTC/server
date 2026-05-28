import * as z from "zod";

export const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";

function trimOrUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function parsePositiveIntOrUndefined(value: string | undefined) {
  const trimmed = trimOrUndefined(value);
  if (!trimmed) return undefined;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const optionalString = z.string().optional();
const optionalUrl = z.string().url().optional();
const optionalPositiveInt = z.number().int().positive().optional();

const commonEnvSchema = z.object({
  DATABASE_URL: optionalString,
  APP_PUBLIC_ORIGIN: optionalUrl,
  APP_CANONICAL_ORIGIN: optionalUrl,
  AUTH_SECRET: optionalString,
  AUTH_GITHUB_ID: optionalString,
  AUTH_GITHUB_SECRET: optionalString,
  AUTH_GOOGLE_ID: optionalString,
  AUTH_GOOGLE_SECRET: optionalString,
  AUTH_OIDC_ISSUER: optionalUrl,
  AUTH_OIDC_CLIENT_ID: optionalString,
  AUTH_OIDC_CLIENT_SECRET: optionalString,
  OAUTH_PROXY_SECRET: optionalString,
  S3_BUCKET: optionalString,
  AWS_REGION: optionalString,
  AWS_ENDPOINT_URL_S3: optionalUrl,
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  UPLOAD_TOTAL_QUOTA_MB: optionalPositiveInt,
  E2E_DEBUG_AUTH: optionalString,
  VERCEL: optionalString,
});

const runtimeRequiredEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
});

type Env = z.output<typeof commonEnvSchema>;

/* ------------------------------------------------------------------ */
/*  Env normalization                                                  */
/* ------------------------------------------------------------------ */

function normalizeEnvInput(input: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => {
        if (key === "UPLOAD_TOTAL_QUOTA_MB")
          return [key, parsePositiveIntOrUndefined(value)];
        return [key, trimOrUndefined(value)];
      })
      .filter(([, v]) => v !== undefined),
  );
}

/* ------------------------------------------------------------------ */
/*  Load & validate                                                    */
/* ------------------------------------------------------------------ */

function formatIssues(issues: z.ZodIssue[]) {
  return issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
}

function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  input: NodeJS.ProcessEnv,
  prefix = "Invalid environment variables",
): z.output<T> {
  const result = schema.safeParse(normalizeEnvInput(input));
  if (result.success) return result.data;
  throw new Error(`${prefix}:\n${formatIssues(result.error.issues)}`);
}

export function loadEnv(
  options: { input?: NodeJS.ProcessEnv; nextPhase?: string } = {},
): Env {
  const input = options.input ?? process.env;
  const nextPhase = options.nextPhase ?? trimOrUndefined(input.NEXT_PHASE);

  const result = commonEnvSchema.safeParse(normalizeEnvInput(input));
  if (!result.success) {
    console.error(
      `❌ Invalid environment variables:\n${formatIssues(result.error.issues)}`,
    );
    throw new Error("Invalid environment variables");
  }

  const env = result.data;

  // Skip runtime-required checks during production build and development
  if (
    nextPhase === NEXT_PRODUCTION_BUILD_PHASE ||
    env.NODE_ENV === "development"
  ) {
    return env;
  }

  const runtimeResult = runtimeRequiredEnvSchema.safeParse(env);
  if (!runtimeResult.success) {
    console.error(
      `❌ Invalid environment variables:\n${formatIssues(runtimeResult.error.issues)}`,
    );
    throw new Error("Invalid environment variables");
  }

  return env;
}

/* ------------------------------------------------------------------ */
/*  Convenience getters                                                */
/* ------------------------------------------------------------------ */

export function getOptionalTrimmedEnv(
  name: string,
  input: NodeJS.ProcessEnv = process.env,
) {
  return trimOrUndefined(input[name]);
}

export function isNextProductionBuildPhase(
  input: NodeJS.ProcessEnv = process.env,
) {
  return (
    getOptionalTrimmedEnv("NEXT_PHASE", input) === NEXT_PRODUCTION_BUILD_PHASE
  );
}

export function getAuthEnv(input: NodeJS.ProcessEnv = process.env) {
  return parseEnv(
    commonEnvSchema.pick({
      AUTH_GITHUB_ID: true,
      AUTH_GITHUB_SECRET: true,
      AUTH_GOOGLE_ID: true,
      AUTH_GOOGLE_SECRET: true,
      AUTH_OIDC_ISSUER: true,
      AUTH_OIDC_CLIENT_ID: true,
      AUTH_OIDC_CLIENT_SECRET: true,
      AUTH_SECRET: true,
      OAUTH_PROXY_SECRET: true,
      E2E_DEBUG_AUTH: true,
      NODE_ENV: true,
      VERCEL: true,
    }),
    input,
    "Invalid auth environment variables",
  );
}

export function getUploadEnv(input: NodeJS.ProcessEnv = process.env) {
  return parseEnv(
    commonEnvSchema.pick({ UPLOAD_TOTAL_QUOTA_MB: true }),
    input,
    "Invalid upload environment variables",
  );
}

export function getStorageEnv(input: NodeJS.ProcessEnv = process.env) {
  return parseEnv(
    commonEnvSchema.pick({
      S3_BUCKET: true,
      AWS_REGION: true,
      AWS_ENDPOINT_URL_S3: true,
    }),
    input,
    "Invalid storage environment variables",
  );
}
