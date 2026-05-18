import * as z from "zod";

export const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";

const optionalStringSchema = z.string().optional();
const optionalUrlSchema = z.string().url().optional();
const optionalPositiveIntSchema = z.number().int().positive().optional();

const commonEnvSchema = z.object({
  DATABASE_URL: optionalStringSchema,
  APP_PUBLIC_ORIGIN: optionalUrlSchema,
  APP_CANONICAL_ORIGIN: optionalUrlSchema,
  JWT_SECRET: optionalStringSchema,
  AUTH_SECRET: optionalStringSchema,
  BETTER_AUTH_SECRET: optionalStringSchema,

  // OAuth providers (optional)
  AUTH_GITHUB_ID: optionalStringSchema,
  AUTH_GITHUB_SECRET: optionalStringSchema,
  AUTH_GOOGLE_ID: optionalStringSchema,
  AUTH_GOOGLE_SECRET: optionalStringSchema,
  AUTH_OIDC_ISSUER: optionalUrlSchema,
  AUTH_OIDC_CLIENT_ID: optionalStringSchema,
  AUTH_OIDC_CLIENT_SECRET: optionalStringSchema,
  OAUTH_PROXY_SECRET: optionalStringSchema,

  // S3 storage (optional outside upload flows)
  S3_BUCKET: optionalStringSchema,
  AWS_REGION: optionalStringSchema,
  AWS_ENDPOINT_URL: optionalUrlSchema,
  AWS_ENDPOINT_URL_S3: optionalUrlSchema,
  AWS_ACCESS_KEY_ID: optionalStringSchema,
  AWS_SECRET_ACCESS_KEY: optionalStringSchema,
  AWS_SESSION_TOKEN: optionalStringSchema,

  // Runtime
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  WEBHOOK_SECRET: optionalStringSchema,
  UPLOAD_TOTAL_QUOTA_MB: optionalPositiveIntSchema,
  OAUTH_DEBUG_LOGGING: optionalStringSchema,
  E2E_DEBUG_AUTH: optionalStringSchema,
  PRISMA_QUERY_DEBUG: optionalStringSchema,
  PRISMA_SLOW_QUERY_MS: optionalStringSchema,

  // Deployment metadata
  VERCEL: optionalStringSchema,
  VERCEL_URL: optionalStringSchema,
  VERCEL_PROJECT_PRODUCTION_URL: optionalStringSchema,
});

const runtimeRequiredEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    AUTH_SECRET: optionalStringSchema,
    BETTER_AUTH_SECRET: optionalStringSchema,
  })
  .refine(
    ({ AUTH_SECRET, BETTER_AUTH_SECRET }) =>
      Boolean(AUTH_SECRET || BETTER_AUTH_SECRET),
    {
      message: "AUTH_SECRET or BETTER_AUTH_SECRET is required",
      path: ["AUTH_SECRET"],
    },
  );

const authEnvSchema = commonEnvSchema.pick({
  AUTH_GITHUB_ID: true,
  AUTH_GITHUB_SECRET: true,
  AUTH_GOOGLE_ID: true,
  AUTH_GOOGLE_SECRET: true,
  AUTH_OIDC_ISSUER: true,
  AUTH_OIDC_CLIENT_ID: true,
  AUTH_OIDC_CLIENT_SECRET: true,
  AUTH_SECRET: true,
  BETTER_AUTH_SECRET: true,
  OAUTH_PROXY_SECRET: true,
  E2E_DEBUG_AUTH: true,
  NODE_ENV: true,
  VERCEL: true,
});

const uploadEnvSchema = commonEnvSchema.pick({
  UPLOAD_TOTAL_QUOTA_MB: true,
});

const storageEnvSchema = commonEnvSchema.pick({
  S3_BUCKET: true,
  AWS_REGION: true,
  AWS_ENDPOINT_URL: true,
  AWS_ENDPOINT_URL_S3: true,
  AWS_ACCESS_KEY_ID: true,
  AWS_SECRET_ACCESS_KEY: true,
  AWS_SESSION_TOKEN: true,
});

const envCacheKeys = [
  "DATABASE_URL",
  "APP_PUBLIC_ORIGIN",
  "APP_CANONICAL_ORIGIN",
  "JWT_SECRET",
  "AUTH_SECRET",
  "BETTER_AUTH_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_OIDC_ISSUER",
  "AUTH_OIDC_CLIENT_ID",
  "AUTH_OIDC_CLIENT_SECRET",
  "OAUTH_PROXY_SECRET",
  "S3_BUCKET",
  "AWS_REGION",
  "AWS_ENDPOINT_URL",
  "AWS_ENDPOINT_URL_S3",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "NODE_ENV",
  "LOG_LEVEL",
  "WEBHOOK_SECRET",
  "UPLOAD_TOTAL_QUOTA_MB",
  "OAUTH_DEBUG_LOGGING",
  "E2E_DEBUG_AUTH",
  "PRISMA_QUERY_DEBUG",
  "PRISMA_SLOW_QUERY_MS",
  "VERCEL",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;

export type Env = z.output<typeof commonEnvSchema>;
export type DevEnv = Env;
export type AuthEnv = z.output<typeof authEnvSchema>;
export type UploadEnv = z.output<typeof uploadEnvSchema>;
export type StorageEnv = z.output<typeof storageEnvSchema>;

type LoadEnvOptions = {
  input?: NodeJS.ProcessEnv;
  nextPhase?: string;
};

let cachedEnv: Env | null = null;
let cachedEnvKey: string | null = null;

function normalizeOptionalEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptionalPositiveInt(value: string | undefined) {
  const trimmed = normalizeOptionalEnvValue(value);
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function normalizeEnvInput(input: NodeJS.ProcessEnv) {
  const entries = Object.entries(input).map(([key, value]) => {
    if (key === "UPLOAD_TOTAL_QUOTA_MB") {
      return [key, parseOptionalPositiveInt(value)] as const;
    }

    return [key, normalizeOptionalEnvValue(value)] as const;
  });

  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

function formatEnvIssues(issues: z.ZodIssue[]) {
  return issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

function buildEnvCacheKey(input: NodeJS.ProcessEnv, nextPhase?: string) {
  return [
    ...envCacheKeys.map((key) => `${key}=${input[key] ?? ""}`),
    `NEXT_PHASE=${nextPhase ?? ""}`,
  ].join("\u0000");
}

function parseEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: NodeJS.ProcessEnv,
  errorPrefix = "Invalid environment variables",
): z.output<TSchema> {
  const result = schema.safeParse(normalizeEnvInput(input));
  if (result.success) {
    return result.data;
  }

  throw new Error(`${errorPrefix}:\n${formatEnvIssues(result.error.issues)}`);
}

function validateRuntimeEnv(input: NodeJS.ProcessEnv, nextPhase?: string): Env {
  const normalized = normalizeEnvInput(input);
  const result = commonEnvSchema.safeParse(normalized);

  if (!result.success) {
    const formatted = formatEnvIssues(result.error.issues);
    console.error(`❌ Invalid environment variables:\n${formatted}`);
    throw new Error("Invalid environment variables");
  }

  const validatedEnv = result.data;

  if (
    nextPhase === NEXT_PRODUCTION_BUILD_PHASE ||
    validatedEnv.NODE_ENV === "development"
  ) {
    return validatedEnv;
  }

  const runtimeResult = runtimeRequiredEnvSchema.safeParse(validatedEnv);
  if (!runtimeResult.success) {
    const formatted = formatEnvIssues(runtimeResult.error.issues);
    console.error(`❌ Invalid environment variables:\n${formatted}`);
    throw new Error("Invalid environment variables");
  }

  return validatedEnv;
}

export function loadEnv(options: LoadEnvOptions = {}): Env {
  const input = options.input ?? process.env;
  const nextPhase =
    options.nextPhase ?? getOptionalTrimmedEnv("NEXT_PHASE", input);

  if (input === process.env) {
    const nextCacheKey = buildEnvCacheKey(input, nextPhase);
    if (cachedEnv && cachedEnvKey === nextCacheKey) {
      return cachedEnv;
    }

    const validated = validateRuntimeEnv(input, nextPhase);
    cachedEnv = validated;
    cachedEnvKey = nextCacheKey;
    return validated;
  }

  return validateRuntimeEnv(input, nextPhase);
}

export const env = new Proxy({} as Env, {
  get(_target, property) {
    return loadEnv()[property as keyof Env];
  },
});

export function getOptionalEnvValue(
  name: string,
  input: NodeJS.ProcessEnv = process.env,
) {
  return input[name];
}

export function getOptionalTrimmedEnv(
  name: string,
  input: NodeJS.ProcessEnv = process.env,
) {
  return normalizeOptionalEnvValue(getOptionalEnvValue(name, input));
}

export function getOptionalLowercaseEnv(
  name: string,
  input: NodeJS.ProcessEnv = process.env,
) {
  return getOptionalTrimmedEnv(name, input)?.toLowerCase();
}

export function getFirstOptionalTrimmedEnv(
  names: readonly string[],
  input: NodeJS.ProcessEnv = process.env,
) {
  for (const name of names) {
    const value = getOptionalTrimmedEnv(name, input);
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function getOptionalIntEnv(
  name: string,
  input: NodeJS.ProcessEnv = process.env,
) {
  const parsed = parseOptionalPositiveInt(input[name]);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function getEnvFlag(
  name: string,
  input: NodeJS.ProcessEnv = process.env,
) {
  return getOptionalTrimmedEnv(name, input) === "1";
}

export function isNodeEnv(
  value: "development" | "production" | "test",
  input: NodeJS.ProcessEnv = process.env,
) {
  return getOptionalTrimmedEnv("NODE_ENV", input) === value;
}

export function isNextProductionBuildPhase(
  input: NodeJS.ProcessEnv = process.env,
) {
  return (
    getOptionalTrimmedEnv("NEXT_PHASE", input) === NEXT_PRODUCTION_BUILD_PHASE
  );
}

export function getAuthEnv(input: NodeJS.ProcessEnv = process.env): AuthEnv {
  return parseEnv(authEnvSchema, input, "Invalid auth environment variables");
}

export function getUploadEnv(
  input: NodeJS.ProcessEnv = process.env,
): UploadEnv {
  return parseEnv(
    uploadEnvSchema,
    input,
    "Invalid upload environment variables",
  );
}

export function getStorageEnv(
  input: NodeJS.ProcessEnv = process.env,
): StorageEnv {
  return parseEnv(
    storageEnvSchema,
    input,
    "Invalid storage environment variables",
  );
}
