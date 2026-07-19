export function createAdminOAuthControllerDefaultState<Client>(input: {
  authMethods: readonly string[];
}) {
  return {
    copyMessage: "",
    copyMessageVariant: "default" as "destructive" | "default",
    deletingClientId: null as string | null,
    isCreateDialogOpen: false,
    isCreatingClient: false,
    isCredentialsDialogOpen: false,
    isMounted: false,
    pendingDeleteClient: null as Client | null,
    redirectDraft: "",
    selectedAuthMethod: input.authMethods[0] ?? "client_secret_basic",
    selectedScopes: [
      "openid",
      "profile",
      "me:read",
      "todo:read",
      "todo:write",
      "homework:read",
      "homework:write",
    ],
  };
}
