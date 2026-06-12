import type { SubmitFunction } from "@sveltejs/kit";

export type SettingsProfileCopy = {
  cancel: string;
  cannotDisconnectLast: string;
  connect: string;
  connected: string;
  deleteAccount: string;
  deleteAccountConfirmDescription: string;
  deleteAccountConfirmPrompt: string;
  deleteAccountConfirmTitle: string;
  deleteAccountDescription: string;
  deleteAccountTitle: string;
  disconnect: string;
  disconnectConfirmDescription: string;
  disconnectConfirmTitle: string;
  disconnectSuccess: string;
  disconnectSuccessDescription: string;
  disconnecting: string;
  editProfile: string;
  editProfileDescription: string;
  linkedAccounts: string;
  linkedAccountsDescription: string;
  name: string;
  namePlaceholder: string;
  notConnected: string;
  pleaseWait: string;
  profilePicture: string;
  save: string;
  updateError: string;
  updateSuccess: string;
  updateSuccessDescription: string;
  username: string;
  usernamePlaceholder: string;
  usernameValidation: string;
};

export type SettingsCopy = {
  accessibility: {
    avatarOption: string;
  };
  common: {
    home: string;
  };
  profile: SettingsProfileCopy;
  settings: {
    content: {
      browseSections: {
        description: string;
        title: string;
      };
      commentGuide: {
        description: string;
        title: string;
      };
      description: string;
      emptyDescription: string;
      emptyTitle: string;
      title: string;
    };
    description: string;
    title: string;
    workspaceBadge: string;
  };
};

export type SettingsUser = {
  accountCount: number;
  name?: string | null;
  username?: string | null;
};

export type SettingsAccount = {
  id: string;
  linked: boolean;
  name: string;
  providerAccountId?: string | null;
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
