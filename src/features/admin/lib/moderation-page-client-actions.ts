import type { SubmitFunction } from "@sveltejs/kit";

export type PendingModerationServerAction =
  | "description"
  | "deleteHomework"
  | "liftSuspension";

export function createAdminActionEnhancer(input: {
  setPendingServerAction: (value: PendingModerationServerAction | null) => void;
}) {
  return function enhanceAdminAction(
    action: PendingModerationServerAction,
    onSuccess?: () => void,
  ): SubmitFunction {
    return () => {
      input.setPendingServerAction(action);
      return async ({ result, update }) => {
        try {
          await update();
          if (result.type === "success") onSuccess?.();
        } finally {
          input.setPendingServerAction(null);
        }
      };
    };
  };
}

export function createModerationQueueRefresh(input: {
  getUpdateFailedCopy: () => string;
  invalidateAll: () => Promise<void>;
  setIsRefreshingQueue: (value: boolean) => void;
  setRefreshError: (value: string) => void;
}) {
  return async function refreshQueue() {
    input.setIsRefreshingQueue(true);
    input.setRefreshError("");
    try {
      await input.invalidateAll();
    } catch {
      input.setRefreshError(input.getUpdateFailedCopy());
    } finally {
      input.setIsRefreshingQueue(false);
    }
  };
}
