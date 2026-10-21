import type { SubmitFunction } from "$app/forms";

export function createPendingEnhancedAction(input: {
  setPendingAction: (value: string | null) => void;
}) {
  return function enhancedAction(
    actionKey: string,
    onSuccess?: (data: Record<string, unknown> | undefined) => void,
  ): SubmitFunction {
    return () => {
      input.setPendingAction(actionKey);
      return async ({ result, update }) => {
        try {
          await update({ navigate: false });
          if (result.type === "success") onSuccess?.(result.data);
        } finally {
          input.setPendingAction(null);
        }
      };
    };
  };
}

/**
 * The outcome message the server action reported, when it carries detail the
 * client cannot reconstruct (an import summary, a count, a resolved name).
 */
export function serverOutcomeMessage(
  data: Record<string, unknown> | undefined,
) {
  const message = data?.message;
  return typeof message === "string" && message.trim() !== "" ? message : null;
}
