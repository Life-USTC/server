import {
  moderationCommentDialogState,
  saveModerationCommentRequest,
  suspendModerationCommentAuthorRequest,
} from "@/features/admin/lib/moderation-controller";
import type { ModerationCommentLike } from "./moderation-display-types";
import {
  createAdminActionEnhancer,
  createModerationQueueRefresh,
  type PendingModerationServerAction,
} from "./moderation-page-client-actions";

export function createModerationPageActions<
  CommentShape extends ModerationCommentLike,
>(input: {
  closeCommentDialog: () => void;
  formatDate: (value: string | Date) => string;
  getCommentStatus: () => "active" | "softbanned" | "deleted";
  getCopy: () => {
    suspendFailed: string;
    suspendSuccess: string;
    updateFailed: string;
    defaultBanReason: string;
  };
  getCustomExpiresAt: () => string;
  getModerationNote: () => string;
  getSelectedComment: () => CommentShape | null;
  getSuspensionDuration: () => string;
  getSuspensionReason: () => string;
  invalidateAll: () => Promise<void>;
  setCommentStatus: (value: "active" | "softbanned" | "deleted") => void;
  setCustomExpiresAt: (value: string) => void;
  setDialogMessage: (value: string) => void;
  setIsRefreshingQueue: (value: boolean) => void;
  setIsSavingComment: (value: boolean) => void;
  setIsSuspendingUser: (value: boolean) => void;
  setModerationNote: (value: string) => void;
  setPendingServerAction: (value: PendingModerationServerAction | null) => void;
  setRefreshError: (value: string) => void;
  setSelectedComment: (value: CommentShape | null) => void;
  setSuspensionDuration: (value: string) => void;
  setSuspensionReason: (value: string) => void;
}) {
  const enhanceAdminAction = createAdminActionEnhancer({
    setPendingServerAction: input.setPendingServerAction,
  });
  const refreshQueue = createModerationQueueRefresh({
    getUpdateFailedCopy: () => input.getCopy().updateFailed,
    invalidateAll: input.invalidateAll,
    setIsRefreshingQueue: input.setIsRefreshingQueue,
    setRefreshError: input.setRefreshError,
  });

  function openCommentDialog(comment: CommentShape) {
    const next = moderationCommentDialogState({
      comment,
      copy: input.getCopy(),
      formatDate: input.formatDate,
      origin: typeof window === "undefined" ? null : window.location.origin,
    });
    input.setSelectedComment(comment);
    input.setCommentStatus(next.commentStatus);
    input.setModerationNote(next.moderationNote);
    input.setSuspensionReason(next.suspensionReason);
    input.setSuspensionDuration(next.suspensionDuration);
    input.setCustomExpiresAt(next.customExpiresAt);
    input.setDialogMessage(next.dialogMessage);
  }

  async function saveCommentModeration() {
    const selectedComment = input.getSelectedComment();
    if (!selectedComment) return;
    const copy = input.getCopy();
    input.setIsSavingComment(true);
    input.setDialogMessage("");
    try {
      await saveModerationCommentRequest({
        commentId: String(selectedComment.id),
        fallbackMessage: copy.updateFailed,
        moderationNote: input.getModerationNote(),
        status: input.getCommentStatus(),
      });
      input.closeCommentDialog();
      await input.invalidateAll();
    } catch (error) {
      input.setDialogMessage(
        error instanceof Error ? error.message : copy.updateFailed,
      );
    } finally {
      input.setIsSavingComment(false);
    }
  }

  async function suspendCommentAuthor() {
    const userId = input.getSelectedComment()?.user?.id;
    if (!userId) return;
    const copy = input.getCopy();
    input.setIsSuspendingUser(true);
    input.setDialogMessage("");
    try {
      await suspendModerationCommentAuthorRequest({
        customExpiresAt: input.getCustomExpiresAt(),
        duration: input.getSuspensionDuration(),
        fallbackMessage: copy.suspendFailed,
        reason: input.getSuspensionReason(),
        userId,
      });
      input.setDialogMessage(copy.suspendSuccess);
      await input.invalidateAll();
    } catch (error) {
      input.setDialogMessage(
        error instanceof Error ? error.message : copy.suspendFailed,
      );
    } finally {
      input.setIsSuspendingUser(false);
    }
  }

  return {
    enhanceAdminAction,
    openCommentDialog,
    refreshQueue,
    saveCommentModeration,
    suspendCommentAuthor,
  };
}
