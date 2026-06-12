import { betterAuth } from "better-auth";
import { buildBetterAuthOptions } from "@/lib/auth/better-auth-options";
import { type AppSession, mapAppSession } from "@/lib/auth/session";

const authInstance = betterAuth(buildBetterAuthOptions());

export const authApi = authInstance.api;
export const betterAuthInstance = authInstance;

export async function getSessionFromHeaders(
  headers: Headers,
): Promise<AppSession | null> {
  const session = await authInstance.api.getSession({ headers });
  return session ? mapAppSession(session) : null;
}
