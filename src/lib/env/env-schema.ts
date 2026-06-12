import * as z from "zod";

const optionalString = z.string().optional();
const optionalUrl = z.string().url().optional();
const optionalPositiveInt = z.number().int().positive().optional();

export const commonEnvSchema = z.object({
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

export const runtimeRequiredEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
});

export type Env = z.output<typeof commonEnvSchema>;
