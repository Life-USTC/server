import type { createCommentPanelDefaultState } from "./comment-panel-default-state";
import type { CommentEditorMode } from "./comment-panel-draft-state";
import { commentUploadPendingStateWithDelta } from "./comment-panel-upload-state";
import { attachmentMarkdown, formatUploadSize } from "./comment-ui";
import {
  type CommentUploadSummary,
  loadCommentUploadSummary,
  uploadCommentAttachment,
} from "./comment-upload-client";

type UploadCopy = {
  toastFileTooLargeDescription: string;
  toastQuotaExceededDescription: string;
  toastUploadErrorDescription: string;
  toastUploadSuccessDescription: string;
  uploading: string;
};

export function createCommentPanelUploadActions(input: {
  panel: ReturnType<typeof createCommentPanelDefaultState>;
  getUploadCopy: () => UploadCopy;
  insertMarkdown: (value: string, mode: CommentEditorMode) => void;
  onSuccess?: (filename: string) => void;
  replaceMarkdownToken: (
    token: string,
    replacement: string,
    mode: CommentEditorMode,
  ) => void;
}) {
  const { panel } = input;
  function updatePendingUploads(mode: CommentEditorMode, delta: number) {
    panel.uploadPending = commentUploadPendingStateWithDelta({
      mode,
      delta,
      state: panel.uploadPending,
    });
  }
  let uploadSummary: CommentUploadSummary | null = null;

  async function loadUploadSummary() {
    if (uploadSummary) return uploadSummary;
    uploadSummary = await loadCommentUploadSummary(
      input.getUploadCopy().toastUploadErrorDescription,
    );
    return uploadSummary;
  }

  async function uploadFile(file: File, mode: CommentEditorMode = "new") {
    updatePendingUploads(mode, 1);
    panel.message = "";
    panel.messageVariant = "default";
    const uploadCopy = input.getUploadCopy();
    const token = `![${uploadCopy.uploading} ${file.name}](upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)})`;
    input.insertMarkdown(token, mode);
    try {
      const upload = await uploadCommentAttachment({
        file,
        formatSize: formatUploadSize,
        loadSummary: loadUploadSummary,
        setSummary: (summary) => {
          uploadSummary = summary;
        },
        uploadCopy,
      });
      if (mode === "edit") {
        panel.editAttachmentIds = [...panel.editAttachmentIds, upload.id];
        panel.editUploadedFiles = [...panel.editUploadedFiles, upload];
      } else if (mode === "reply") {
        panel.replyAttachmentIds = [...panel.replyAttachmentIds, upload.id];
        panel.replyUploadedFiles = [...panel.replyUploadedFiles, upload];
      } else {
        panel.selectedAttachments = [...panel.selectedAttachments, upload.id];
        panel.uploadedFiles = [...panel.uploadedFiles, upload];
      }
      input.replaceMarkdownToken(token, attachmentMarkdown(file, upload), mode);
      input.onSuccess?.(upload.filename);
    } catch (error) {
      input.replaceMarkdownToken(token, "", mode);
      panel.message =
        error instanceof Error
          ? error.message
          : uploadCopy.toastUploadErrorDescription;
      panel.messageVariant = "destructive";
    } finally {
      updatePendingUploads(mode, -1);
    }
  }

  return {
    uploadFile,
  };
}
