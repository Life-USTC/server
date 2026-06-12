import type { ViewerContext } from "@/lib/auth/viewer-context";
import { submitCommentRequest } from "./comment-panel-actions";
import { loadCommentsForTargets } from "./comment-panel-data";
import { buildCommentSubmitPayload } from "./comment-panel-submit-payload";
import type {
  CommentNodeWithContext,
  CommentTargetOption,
  CommentTargetType,
} from "./comment-ui";
import type { CommentUploadOption } from "./comment-upload-client";

type CommentLoadSubmitCopy = {
  loadFailed: string;
  submitFailed: string;
};

export function createCommentPanelLoadSubmitActions(input: {
  cancelReply: () => void;
  getBody: () => string;
  getCommentCopy: () => CommentLoadSubmitCopy;
  getIsAnonymous: () => boolean;
  getReplyAttachmentIds: () => string[];
  getReplyIsAnonymous: () => boolean;
  getReplyVisibility: () => string;
  getSelectedAttachments: () => string[];
  getShowAllTargets: () => boolean;
  getSubmitting: () => boolean;
  getTargetType: () => CommentTargetType;
  getTargets: () => CommentTargetOption[];
  getVisibility: () => string;
  scrollToHashComment: () => Promise<void>;
  selectedPostTarget: () => CommentTargetOption | null;
  setBody: (value: string) => void;
  setComments: (value: CommentNodeWithContext[]) => void;
  setHiddenCount: (value: number) => void;
  setLoading: (value: boolean) => void;
  setMessage: (value: string) => void;
  setSelectedAttachments: (value: string[]) => void;
  setSubmitting: (value: boolean) => void;
  setUploadedFiles: (value: CommentUploadOption[]) => void;
  setViewer: (value: ViewerContext) => void;
}) {
  async function loadComments() {
    input.setLoading(true);
    input.setMessage("");
    const copy = input.getCommentCopy();
    try {
      const result = await loadCommentsForTargets({
        loadFailed: copy.loadFailed,
        showAllTargets: input.getShowAllTargets(),
        targets: input.getTargets(),
      });
      input.setComments(result.comments);
      input.setHiddenCount(result.hiddenCount);
      if (result.viewer) input.setViewer(result.viewer);
      await input.scrollToHashComment();
    } catch (error) {
      input.setMessage(
        error instanceof Error ? error.message : copy.loadFailed,
      );
    } finally {
      input.setLoading(false);
    }
  }

  async function submitComment(
    parentId?: string | null,
    replyBody?: string,
    target: CommentTargetOption | null = input.selectedPostTarget(),
  ) {
    const body = (replyBody ?? input.getBody()).trim();
    if (!body || input.getSubmitting()) return;
    input.setSubmitting(true);
    input.setMessage("");
    const copy = input.getCommentCopy();
    try {
      await submitCommentRequest(
        buildCommentSubmitPayload({
          body,
          getIsAnonymous: input.getIsAnonymous,
          getReplyAttachmentIds: input.getReplyAttachmentIds,
          getReplyIsAnonymous: input.getReplyIsAnonymous,
          getReplyVisibility: input.getReplyVisibility,
          getSelectedAttachments: input.getSelectedAttachments,
          getTargetType: input.getTargetType,
          getVisibility: input.getVisibility,
          parentId: parentId ?? undefined,
          submitFailed: copy.submitFailed,
          target,
        }),
      );
      input.setBody("");
      input.cancelReply();
      input.setSelectedAttachments([]);
      input.setUploadedFiles([]);
      await loadComments();
    } catch (error) {
      input.setMessage(
        error instanceof Error ? error.message : copy.submitFailed,
      );
    } finally {
      input.setSubmitting(false);
    }
  }

  return {
    loadComments,
    submitComment,
  };
}
