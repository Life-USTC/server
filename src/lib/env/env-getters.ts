import { APP_PRODUCTION_BUILD_PHASE } from "./env-constants";
import { trimOrUndefined, normalizeEnvInput } from "./env-normalize";
import { formatIssues, parseEnv } from "./env-parse";
import {
  commonEnvSchema,
  type Env,
  runtimeRequiredEnvSchema,
} from "./env-schema";
import { getCloudflareRuntimeEnvInput } from "@/lib/cloudflare/runtime-env";

function getDefaultEnvInput(): NodeJS.ProcessEnv {
  const processEnv =
    typeof process === "undefined" || !process.env ? {} : process.env;
  return { ...processEnv, ...getCloudflareRuntimeEnvInput() };
}

export function loadEnv(
  options: { input?: NodeJS.ProcessEnv; appPhase?: string } = {},
): Env {
  const input = options.input ?? getDefaultEnvInput();
  const appPhase = options.appPhase ?? trimOrUndefined(input.APP_PHASE);

  const result = commonEnvSchema.safeParse(normalizeEnvInput(input));
  if (!result.success) {
    console.error(
      `❌ Invalid environment variables:\n${formatIssues(result.error.issues)}`,
    );
    throw new Error("Invalid environment variables");
  }

  const env = result.data;

  if (
    appPhase === APP_PRODUCTION_BUILD_PHASE ||
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

export function getOptionalTrimmedEnv(
  name: string,
  input: NodeJS.ProcessEnv = getDefaultEnvInput(),
) {
  return trimOrUndefined(input[name]);
}

export function isAppProductionBuildPhase(
  input: NodeJS.ProcessEnv = getDefaultEnvInput(),
) {
  return (
    getOptionalTrimmedEnv("APP_PHASE", input) === APP_PRODUCTION_BUILD_PHASE
  );
}

export function getAuthEnv(input: NodeJS.ProcessEnv = getDefaultEnvInput()) {
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

export function getUploadEnv(input: NodeJS.ProcessEnv = getDefaultEnvInput()) {
  return parseEnv(
    commonEnvSchema.pick({ UPLOAD_TOTAL_QUOTA_MB: true }),
    input,
    "Invalid upload environment variables",
  );
}

export function getStorageEnv(input: NodeJS.ProcessEnv = getDefaultEnvInput()) {
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
