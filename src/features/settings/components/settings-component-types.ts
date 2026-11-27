import type { getSettingsCopy } from "@/features/settings/lib/settings-copy";
import type { UserUstcIdentitySummary } from "@/features/settings/lib/ustc-identity";
import type {
  AccountActivityPage,
  OwnAccountSecurityActivity,
} from "@/features/settings/server/account-activity";
import type { SubmitFunction } from "$app/forms";

export type SettingsCopy = ReturnType<typeof getSettingsCopy>;

export type SettingsSecurityActivity =
  AccountActivityPage<OwnAccountSecurityActivity> & { hasCursor: boolean };

export type SettingsOAuthAuthorization = {
  clientName?: string | null;
  clientUri?: string | null;
  consentId: string;
  disabled: boolean;
  scopes: string[];
  updatedAt: string;
  usage: {
    lastUsedAt: string;
    lastChannel: string;
    lastFeature: string;
    readCount: number;
    writeCount: number;
    errorCount: number;
  } | null;
};

export type SettingsUser = {
  name?: string | null;
  username?: string | null;
};

export type SettingsAccount = {
  id: string;
  canUnlink: boolean;
  linked: boolean;
  name: string;
  providerAccountId?: string | null;
  ustcIdentities?: UserUstcIdentitySummary | null;
};

export type SettingsPendingAccountAction = {
  providerId: string;
  type: "connect" | "disconnect";
} | null;

export type SettingsAccountAction = (
  providerId: string,
  type: Exclude<SettingsPendingAccountAction, null>["type"],
) => SubmitFunction;

export type SettingsDeleteAccountAction = SubmitFunction;
