export function createAdminOAuthControllerDefaultState<Client>(input: {
  authMethods: readonly string[];
}) {
  return {
    activeClientTab: "all" as "trusted" | "public" | "disabled" | "all",
    copyMessage: "",
    copyMessageVariant: "info" as "destructive" | "info",
    deletingClientId: null as string | null,
    externalClientPage: 1,
    isCreateDialogOpen: false,
    isCreatingClient: false,
    isCredentialsDialogOpen: false,
    isMounted: false,
    pendingDeleteClient: null as Client | null,
    redirectDraft: "",
    selectedAuthMethod: input.authMethods[0] ?? "client_secret_basic",
    selectedScopes: ["openid", "profile", "mcp:tools"],
    trustedClientPage: 1,
  };
}
