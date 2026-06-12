import type { SubmitFunction } from "@sveltejs/kit";
import { redirectWithExternalFallback } from "$lib/navigation/redirect";

export function createSettingsAccountAction(input: {
  setPendingAccountAction: (
    value: { providerId: string; type: "connect" | "disconnect" } | null,
  ) => void;
}) {
  return function accountAction(
    providerId: string,
    type: "connect" | "disconnect",
  ): SubmitFunction {
    return () => {
      input.setPendingAccountAction({ providerId, type });
      return async ({ result, update }) => {
        try {
          if (result.type === "redirect") {
            await redirectWithExternalFallback(result.location);
            return;
          }
          await update({ reset: false });
        } finally {
          input.setPendingAccountAction(null);
        }
      };
    };
  };
}

export function createDeleteAccountAction(input: {
  setDeletingAccount: (value: boolean) => void;
}): SubmitFunction {
  return () => {
    input.setDeletingAccount(true);
    return async ({ update }) => {
      try {
        await update();
      } finally {
        input.setDeletingAccount(false);
      }
    };
  };
}
