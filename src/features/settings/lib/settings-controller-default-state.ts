export type SettingsPendingAccountAction = {
  providerId: string;
  type: "connect" | "disconnect";
};

export function createSettingsControllerDefaultState(input: {
  userImage?: string | null;
}) {
  return {
    deleteConfirmValue: "",
    isDeleteAccountOpen: false,
    isDeletingAccount: false,
    isMounted: false,
    pendingAccountAction: null as SettingsPendingAccountAction | null,
    selectedImage: input.userImage ?? undefined,
    unlinkAccountId: null as string | null,
  };
}
