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
  setCopyMessage: (value: string) => void;
  setCopyMessageVariant: (value: "destructive" | "info") => void;
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
      input.setCopyMessage(successMessage);
      input.setCopyMessageVariant("info");
    } catch {
      input.setCopyMessage(copy.copyErrorDescription);
      input.setCopyMessageVariant("destructive");
    }
  }

  function toggleScope(scope: string, checked: boolean) {
    input.setSelectedScopes(
      toggleOAuthScope(input.getSelectedScopes(), scope, checked),
    );
  }

  const createClientAction: SubmitFunction = () => {
    input.setIsCreatingClient(true);
    return async ({ update }) => {
      try {
        await update();
      } finally {
        input.setIsCreatingClient(false);
      }
    };
  };

  const deleteClientAction: SubmitFunction = () => {
    input.setDeletingClientId(input.getPendingDeleteClient()?.clientId ?? null);
    return async ({ update }) => {
      try {
        await update();
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
