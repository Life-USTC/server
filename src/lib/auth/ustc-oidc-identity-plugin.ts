import type { Account } from "@better-auth/core/db";
import { consumeStagedUstcOidcIdentityClaims } from "@/lib/auth/ustc-oidc-identity-staging";
import { syncUstcOidcIdentityFromAccountHook } from "@/lib/auth/ustc-oidc-identity-sync";

async function handleAccountIdentityHook(account: Account | null) {
  if (!account?.userId || !account.providerAccountId) return;

  const stagedClaims = consumeStagedUstcOidcIdentityClaims(
    account.providerAccountId,
  );
  await syncUstcOidcIdentityFromAccountHook(account, stagedClaims);
}

export function ustcOidcIdentityPlugin() {
  return {
    id: "life-ustc-oidc-identity",
    init() {
      return {
        options: {
          databaseHooks: {
            account: {
              create: {
                async after(account: Account) {
                  await handleAccountIdentityHook(account);
                },
              },
              update: {
                async after(account: Account) {
                  await handleAccountIdentityHook(account);
                },
              },
            },
          },
        },
      };
    },
  };
}
