import { betterAuth } from "better-auth";
import { buildBetterAuthOptions } from "@/lib/auth/better-auth-options";
import { type AppSession, mapAppSession } from "@/lib/auth/session";

function createAuthInstance() {
  return betterAuth(buildBetterAuthOptions());
}

type BetterAuthInstance = ReturnType<typeof createAuthInstance>;

let authInstance: BetterAuthInstance | undefined;

function getAuthInstance(): BetterAuthInstance {
  if (!authInstance) {
    authInstance = createAuthInstance();
  }
  return authInstance;
}

function bindInstanceValue<T extends object>(
  target: T,
  property: string | symbol,
) {
  const value = Reflect.get(target, property, target);
  return typeof value === "function" ? value.bind(target) : value;
}

export function getBetterAuthInstance() {
  return getAuthInstance();
}

export const authApi = new Proxy({} as BetterAuthInstance["api"], {
  get(_target, property) {
    return bindInstanceValue(getAuthInstance().api, property);
  },
});

export const betterAuthInstance = new Proxy({} as BetterAuthInstance, {
  get(_target, property) {
    return bindInstanceValue(getAuthInstance(), property);
  },
});

export async function getSessionFromHeaders(
  headers: Headers,
): Promise<AppSession | null> {
  const session = await getAuthInstance().api.getSession({ headers });
  return session ? mapAppSession(session) : null;
}
