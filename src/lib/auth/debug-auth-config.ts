import { getOptionalTrimmedEnv } from "@/app-env";
import { allowE2EDebugAuth, isDevelopment } from "./auth-config";
import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
  type DebugProviderId,
} from "./provider-ids";

export type DebugProviderConfig = {
  username: string;
  name: string;
  email: string;
  password: string;
  isAdmin: boolean;
  image: string;
};

type DebugProviderDefaults = {
  usernameEnv: string;
  username: string;
  nameEnv: string;
  name: string;
  emailEnv: string;
  passwordEnv: string;
  password: string;
  isAdmin: boolean;
  imageSeed: string;
};

const DEBUG_PROVIDER_DEFAULTS: Record<DebugProviderId, DebugProviderDefaults> =
  {
    [DEV_DEBUG_PROVIDER_ID]: {
      usernameEnv: "DEV_DEBUG_USERNAME",
      username: "dev-user",
      nameEnv: "DEV_DEBUG_NAME",
      name: "Dev User",
      emailEnv: "DEV_DEBUG_EMAIL",
      passwordEnv: "DEV_DEBUG_PASSWORD",
      password: "dev-debug-password",
      isAdmin: false,
      imageSeed: "life-ustc-dev-user",
    },
    [DEV_ADMIN_PROVIDER_ID]: {
      usernameEnv: "DEV_ADMIN_USERNAME",
      username: "dev-admin",
      nameEnv: "DEV_ADMIN_NAME",
      name: "Dev Admin User",
      emailEnv: "DEV_ADMIN_EMAIL",
      passwordEnv: "DEV_ADMIN_PASSWORD",
      password: "dev-admin-password",
      isAdmin: true,
      imageSeed: "life-ustc-dev-admin",
    },
  };

const requiresExplicitDebugPassword = allowE2EDebugAuth && !isDevelopment;

function getLowercaseDebugEnv(envName: string, fallback: string) {
  return getOptionalTrimmedEnv(envName)?.toLowerCase() ?? fallback;
}

function getDebugPassword(envName: string, fallback: string) {
  const value = getOptionalTrimmedEnv(envName);
  if (requiresExplicitDebugPassword) {
    if (!value) {
      throw new Error(
        `${envName} is required when E2E_DEBUG_AUTH=1 (non-development NODE_ENV)`,
      );
    }
    return value;
  }

  return value || fallback;
}

function buildDebugProviderConfig({
  usernameEnv,
  username: fallbackUsername,
  nameEnv,
  name,
  emailEnv,
  passwordEnv,
  password,
  isAdmin,
  imageSeed,
}: DebugProviderDefaults): DebugProviderConfig {
  const username = getLowercaseDebugEnv(usernameEnv, fallbackUsername);

  return {
    username,
    name: getOptionalTrimmedEnv(nameEnv) ?? name,
    email: getLowercaseDebugEnv(emailEnv, `${username}@debug.local`),
    password: getDebugPassword(passwordEnv, password),
    isAdmin,
    image: `https://api.dicebear.com/9.x/shapes/svg?seed=${imageSeed}`,
  };
}

const DEBUG_PROVIDER_CONFIGS: Record<DebugProviderId, DebugProviderConfig> = {
  [DEV_DEBUG_PROVIDER_ID]: buildDebugProviderConfig(
    DEBUG_PROVIDER_DEFAULTS[DEV_DEBUG_PROVIDER_ID],
  ),
  [DEV_ADMIN_PROVIDER_ID]: buildDebugProviderConfig(
    DEBUG_PROVIDER_DEFAULTS[DEV_ADMIN_PROVIDER_ID],
  ),
};

export function getDebugProviderConfig(
  providerId: DebugProviderId,
): DebugProviderConfig {
  return DEBUG_PROVIDER_CONFIGS[providerId];
}
