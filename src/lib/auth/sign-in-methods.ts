import { Prisma } from "@/generated/prisma/client";
import {
  createLocalAccountIssuer,
  createOAuthAccountIssuer,
  GOOGLE_ACCOUNT_ISSUER,
} from "./account-issuer";
import { allowDebugAuth } from "./auth-config";
import { getBetterAuthOptionEnv } from "./better-auth-option-env";
import { buildBetterAuthSocialProviders } from "./better-auth-social-providers";

export function enabledSignInProviders(): Record<string, string> {
  const { authEnv, oidcIssuer } = getBetterAuthOptionEnv();
  const social = buildBetterAuthSocialProviders(authEnv);
  return {
    ...(social.github ? { github: createOAuthAccountIssuer("github") } : {}),
    ...(social.google ? { google: GOOGLE_ACCOUNT_ISSUER } : {}),
    ...(authEnv.AUTH_OIDC_CLIENT_ID && authEnv.AUTH_OIDC_CLIENT_SECRET
      ? { oidc: oidcIssuer }
      : {}),
    ...(allowDebugAuth()
      ? { credential: createLocalAccountIssuer("credential") }
      : {}),
  };
}

/**
 * The issuer an account for `providerId` must be stored with. Falls back the
 * way Better Auth 1.7.2 did when a provider carried no issuer of its own, so a
 * provider that is configured but absent from the enabled map still lands in
 * the right namespace rather than an empty one.
 */
export function accountIssuerForProvider(providerId: string) {
  const configured = enabledSignInProviders()[providerId];
  if (configured) return configured;
  return providerId === "credential"
    ? createLocalAccountIssuer(providerId)
    : createOAuthAccountIssuer(providerId);
}

export function hasUsableAccount(
  account: {
    provider: string;
    issuer: string;
    password: string | null;
    providerAccountId: string;
    userId: string;
  },
  enabled: Readonly<Record<string, string>>,
) {
  return (
    enabled[account.provider] === account.issuer &&
    (account.provider !== "credential" ||
      (Boolean(account.password) &&
        account.providerAccountId === account.userId))
  );
}

export async function removeSignInMethod(
  prisma: Pick<Prisma.TransactionClient, "$queryRaw">,
  userId: string,
  kind: "provider" | "account" | "passkey",
  key: string,
): Promise<"last_account" | "not_linked" | "unlinked"> {
  const [result] = await prisma.$queryRaw<{ status: string }[]>(Prisma.sql`
    SELECT public.remove_sign_in_method(
      ${userId}, ${kind}, ${key}, ${JSON.stringify(enabledSignInProviders())}::jsonb
    ) AS status
  `);
  if (
    !result ||
    !["last_account", "not_linked", "unlinked"].includes(result.status)
  ) {
    throw new Error("Unexpected sign-in method removal result");
  }
  return result.status as "last_account" | "not_linked" | "unlinked";
}
