import { getOptionalTrimmedEnv } from "@/app-env";
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
      isAdmin: true,
      imageSeed: "life-ustc-dev-admin",
    },
  };

function getLowercaseDebugEnv(envName: string, fallback: string) {
  return getOptionalTrimmedEnv(envName)?.toLowerCase() ?? fallback;
}

function getDebugPassword(envName: string) {
  const value = getOptionalTrimmedEnv(envName);
  if (value) {
    return value;
  }

  throw new Error(
    `${envName} is required for debug auth credentials; configure it via wrangler.dev.jsonc, wrangler.e2e.jsonc, or the active test harness`,
  );
}

function buildDebugProviderConfig({
  usernameEnv,
  username: fallbackUsername,
  nameEnv,
  name,
  emailEnv,
  passwordEnv,
  isAdmin,
  imageSeed,
}: DebugProviderDefaults): DebugProviderConfig {
  const username = getLowercaseDebugEnv(usernameEnv, fallbackUsername);

  return {
    username,
    name: getOptionalTrimmedEnv(nameEnv) ?? name,
    email: getLowercaseDebugEnv(emailEnv, `${username}@debug.local`),
    password: getDebugPassword(passwordEnv),
    isAdmin,
    image: `https://api.dicebear.com/9.x/shapes/svg?seed=${imageSeed}`,
  };
}

export function getDebugProviderConfig(
  providerId: DebugProviderId,
): DebugProviderConfig {
  return buildDebugProviderConfig(DEBUG_PROVIDER_DEFAULTS[providerId]);
}
