import {
  createLocalAccountIssuer,
  createOAuthAccountIssuer,
} from "@better-auth/core/db";
import { google } from "@better-auth/core/social-providers";
import { Prisma } from "@/generated/prisma/client";
import { allowDebugAuth } from "./auth-config";
import { getBetterAuthOptionEnv } from "./better-auth-option-env";
import { buildBetterAuthSocialProviders } from "./better-auth-social-providers";

export function enabledSignInProviders(): Record<string, string> {
  const { authEnv, oidcIssuer } = getBetterAuthOptionEnv();
  const social = buildBetterAuthSocialProviders(authEnv);
  return {
    ...(social.github ? { github: createOAuthAccountIssuer("github") } : {}),
    ...(social.google ? { google: google(social.google).accountIssuer } : {}),
    ...(authEnv.AUTH_OIDC_CLIENT_ID && authEnv.AUTH_OIDC_CLIENT_SECRET
      ? { oidc: oidcIssuer }
      : {}),
    ...(allowDebugAuth()
      ? { credential: createLocalAccountIssuer("credential") }
      : {}),
  };
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
