import type { SubmitFunction } from "$app/forms";

export function createPendingEnhancedAction(input: {
  setPendingAction: (value: string | null) => void;
}) {
  return function enhancedAction(
    actionKey: string,
    onSuccess?: () => void,
  ): SubmitFunction {
    return () => {
      input.setPendingAction(actionKey);
      return async ({ result, update }) => {
        try {
          await update({ navigate: false });
          if (result.type === "success") onSuccess?.();
        } finally {
          input.setPendingAction(null);
        }
      };
    };
  };
}
