import { getAuthEnv, isNextProductionBuildPhase } from "@/env";

const authEnv = getAuthEnv();

export const isDevelopment = authEnv.NODE_ENV === "development";
export const allowE2EDebugAuth = authEnv.E2E_DEBUG_AUTH === "1";
export const allowDebugAuth = isDevelopment || allowE2EDebugAuth;

if (allowE2EDebugAuth && authEnv.VERCEL === "1") {
  throw new Error(
    "E2E_DEBUG_AUTH must not be set on Vercel/production hosting",
  );
}

export function getBetterAuthSecret() {
  if (authEnv.AUTH_SECRET) {
    return authEnv.AUTH_SECRET;
  }

  if (isNextProductionBuildPhase()) {
    return "life-ustc-next-build-placeholder-not-for-production";
  }

  if (authEnv.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required");
  }

  return undefined;
}
