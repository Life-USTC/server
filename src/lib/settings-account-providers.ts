import type { SettingsAccountProvider } from "@/lib/settings-page-data";

export const SETTINGS_ACCOUNT_PROVIDERS = [
  { id: "github", name: "GitHub" },
  { id: "google", name: "Google" },
  { id: "oidc", name: "USTC" },
] as const;

type LinkedAccount = {
  id: string;
  provider: string;
  providerAccountId: string | null;
};

export function buildSettingsAccountProviders(
  linkedAccounts: LinkedAccount[],
): SettingsAccountProvider[] {
  return SETTINGS_ACCOUNT_PROVIDERS.map<SettingsAccountProvider>((provider) => {
    const account = linkedAccounts.find(
      (item) => item.provider === provider.id,
    );
    return {
      ...provider,
      linked: Boolean(account),
      accountId: account?.id ?? null,
      providerAccountId: account?.providerAccountId ?? null,
    };
  });
}
