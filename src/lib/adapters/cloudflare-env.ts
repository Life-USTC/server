import { APP_PRODUCTION_BUILD_PHASE } from "@/lib/env/env-constants";
import { normalizeEnvInput, trimOrUndefined } from "@/lib/env/env-normalize";
import { formatIssues, parseEnv } from "@/lib/env/env-parse";
import {
  cloudflareRuntimeRequiredEnvSchema,
  commonEnvSchema,
  type Env,
  runtimeRequiredEnvSchema,
} from "@/lib/env/env-schema";
import {
  getCloudflareHyperdriveConnectionString,
  getCloudflareRuntimeEnvInput,
  hasCloudflareRuntimeEnv,
} from "./cloudflare-runtime";

export type { Env };

type EnvInput = Partial<NodeJS.ProcessEnv>;

function getDefaultEnvInput(): EnvInput {
  const processEnv =
    typeof process === "undefined" || !process.env ? {} : process.env;
  return { ...processEnv, ...getCloudflareRuntimeEnvInput() };
}

export function loadEnv(
  options: { input?: EnvInput; appPhase?: string } = {},
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

  const runtimeResult = hasCloudflareRuntimeEnv()
    ? cloudflareRuntimeRequiredEnvSchema.safeParse({
        AUTH_SECRET: env.AUTH_SECRET,
        HYPERDRIVE_CONNECTION_STRING: getCloudflareHyperdriveConnectionString(),
      })
    : runtimeRequiredEnvSchema.safeParse(env);
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
  input: EnvInput = getDefaultEnvInput(),
) {
  return trimOrUndefined(input[name]);
}

export function isAppProductionBuildPhase(
  input: EnvInput = getDefaultEnvInput(),
) {
  return (
    getOptionalTrimmedEnv("APP_PHASE", input) === APP_PRODUCTION_BUILD_PHASE
  );
}

export function getAuthEnv(input: EnvInput = getDefaultEnvInput()) {
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
    }),
    input,
    "Invalid auth environment variables",
  );
}

export function getUploadEnv(input: EnvInput = getDefaultEnvInput()) {
  return parseEnv(
    commonEnvSchema.pick({ UPLOAD_TOTAL_QUOTA_MB: true }),
    input,
    "Invalid upload environment variables",
  );
}
