import type { SubmitFunction } from "@sveltejs/kit";
import { writeClipboardText } from "@/lib/browser/clipboard";
import { toggleOAuthScope } from "./oauth-controller";

export function createOAuthPageActions<
  ClientShape extends {
    clientId?: string | null;
  },
>(input: {
  getAuthMethods: () => string[];
  getCopy: () => Record<string, string>;
  getPendingDeleteClient: () => ClientShape | null;
  getSelectedAuthMethod: () => string;
  getSelectedScopes: () => string[];
  onCopySuccess?: (message: string) => void;
  onSuccess?: (action: "create" | "delete") => void;
  setCopyMessage: (value: string) => void;
  setCopyMessageVariant: (value: "destructive" | "default") => void;
  setDeletingClientId: (value: string | null) => void;
  setIsCreateDialogOpen: (value: boolean) => void;
  setIsCreatingClient: (value: boolean) => void;
  setIsCredentialsDialogOpen: (value: boolean) => void;
  setPendingDeleteClient: (value: ClientShape | null) => void;
  setSelectedAuthMethod: (value: string) => void;
  setSelectedScopes: (value: string[]) => void;
}) {
  function openCreateDialog() {
    const authMethods = input.getAuthMethods();
    if (!authMethods.includes(input.getSelectedAuthMethod())) {
      input.setSelectedAuthMethod(authMethods[0] ?? "client_secret_basic");
    }
    input.setIsCreateDialogOpen(true);
  }

  async function copyText(
    value: string,
    successMessage: string = input.getCopy().copySuccess,
  ) {
    const copy = input.getCopy();
    try {
      if (!value) throw new Error(copy.copyError);
      await writeClipboardText(value);
      input.setCopyMessage("");
      input.setCopyMessageVariant("default");
      input.onCopySuccess?.(successMessage);
      return true;
    } catch {
      input.setCopyMessage(copy.copyErrorDescription);
      input.setCopyMessageVariant("destructive");
      return false;
    }
  }

  function toggleScope(scope: string, checked: boolean) {
    input.setSelectedScopes(
      toggleOAuthScope(input.getSelectedScopes(), scope, checked),
    );
  }

  const createClientAction: SubmitFunction = () => {
    input.setIsCreatingClient(true);
    return async ({ result, update }) => {
      try {
        await update();
        if (result.type === "success") input.onSuccess?.("create");
      } finally {
        input.setIsCreatingClient(false);
      }
    };
  };

  const deleteClientAction: SubmitFunction = () => {
    input.setDeletingClientId(input.getPendingDeleteClient()?.clientId ?? null);
    return async ({ result, update }) => {
      try {
        await update();
        if (result.type === "success") input.onSuccess?.("delete");
        input.setPendingDeleteClient(null);
      } finally {
        input.setDeletingClientId(null);
      }
    };
  };

  return {
    closeCreateDialog: () => input.setIsCreateDialogOpen(false),
    closeCredentialsDialog: () => input.setIsCredentialsDialogOpen(false),
    copyText,
    createClientAction,
    deleteClientAction,
    openCreateDialog,
    toggleScope,
  };
}
