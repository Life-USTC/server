import { getAuthEnv, isAppProductionBuildPhase } from "@/app-env";

export function getAuthRuntimeConfig() {
  const authEnv = getAuthEnv();
  const isDevelopment = authEnv.NODE_ENV === "development";
  const allowE2EDebugAuth = authEnv.E2E_DEBUG_AUTH === "1";
  if (
    allowE2EDebugAuth &&
    (authEnv.VERCEL === "1" || authEnv.NODE_ENV === "production")
  ) {
    throw new Error("E2E_DEBUG_AUTH must not be set in production hosting");
  }

  return {
    authEnv,
    isDevelopment,
    allowE2EDebugAuth,
    allowDebugAuth: isDevelopment || allowE2EDebugAuth,
  };
}

export const isDevelopment = () => getAuthRuntimeConfig().isDevelopment;
export const allowE2EDebugAuth = () => getAuthRuntimeConfig().allowE2EDebugAuth;
export const allowDebugAuth = () => getAuthRuntimeConfig().allowDebugAuth;

export function getBetterAuthSecret() {
  const { authEnv } = getAuthRuntimeConfig();
  if (authEnv.AUTH_SECRET) {
    return authEnv.AUTH_SECRET;
  }

  if (isAppProductionBuildPhase()) {
    return "life-ustc-build-placeholder-not-for-production";
  }

  if (authEnv.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required");
  }

  return undefined;
}
