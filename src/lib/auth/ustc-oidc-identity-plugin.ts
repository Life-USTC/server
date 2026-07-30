import { consumeStagedUstcOidcIdentityClaims } from "@/lib/auth/ustc-oidc-identity-staging";
import { syncUstcOidcIdentityFromAccountHook } from "@/lib/auth/ustc-oidc-identity-sync";

type AccountHookPayload = {
  provider: string;
  providerAccountId: string;
  userId: string;
};

async function handleAccountIdentityHook(account: AccountHookPayload | null) {
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
                async after(account: AccountHookPayload) {
                  await handleAccountIdentityHook(account);
                },
              },
              update: {
                async after(account: AccountHookPayload) {
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
