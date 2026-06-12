import {
  type CommentEditorMode,
  commentAttachmentStateWithUpload,
} from "./comment-panel-controller";
import { applyCommentUploadState } from "./comment-panel-upload-state";
import { attachmentMarkdown, formatUploadSize } from "./comment-ui";
import {
  type CommentUploadOption,
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
  getEditAttachmentIds: () => string[];
  getEditUploadedFiles: () => CommentUploadOption[];
  getReplyAttachmentIds: () => string[];
  getReplyUploadedFiles: () => CommentUploadOption[];
  getSelectedAttachments: () => string[];
  getUploadCopy: () => UploadCopy;
  getUploadedFiles: () => CommentUploadOption[];
  insertMarkdown: (value: string, mode: CommentEditorMode) => void;
  replaceMarkdownToken: (
    token: string,
    replacement: string,
    mode: CommentEditorMode,
  ) => void;
  setEditAttachmentIds: (value: string[]) => void;
  setEditUploadedFiles: (value: CommentUploadOption[]) => void;
  setMessage: (value: string) => void;
  setReplyAttachmentIds: (value: string[]) => void;
  setReplyUploadedFiles: (value: CommentUploadOption[]) => void;
  setSelectedAttachments: (value: string[]) => void;
  setUploading: (value: boolean) => void;
  setUploadedFiles: (value: CommentUploadOption[]) => void;
}) {
  let uploadSummary: CommentUploadSummary | null = null;

  async function loadUploadSummary() {
    if (uploadSummary) return uploadSummary;
    uploadSummary = await loadCommentUploadSummary(
      input.getUploadCopy().toastUploadErrorDescription,
    );
    return uploadSummary;
  }

  async function uploadFile(file: File, mode: CommentEditorMode = "new") {
    input.setUploading(true);
    input.setMessage("");
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
      const next = commentAttachmentStateWithUpload({
        editAttachmentIds: input.getEditAttachmentIds(),
        editUploadedFiles: input.getEditUploadedFiles(),
        mode,
        replyAttachmentIds: input.getReplyAttachmentIds(),
        replyUploadedFiles: input.getReplyUploadedFiles(),
        selectedAttachments: input.getSelectedAttachments(),
        upload,
        uploadedFiles: input.getUploadedFiles(),
      });
      applyCommentUploadState(next, input);
      input.replaceMarkdownToken(token, attachmentMarkdown(file, upload), mode);
      input.setMessage(
        uploadCopy.toastUploadSuccessDescription.replace(
          "{name}",
          upload.filename,
        ),
      );
    } catch (error) {
      input.replaceMarkdownToken(token, "", mode);
      input.setMessage(
        error instanceof Error
          ? error.message
          : uploadCopy.toastUploadErrorDescription,
      );
    } finally {
      input.setUploading(false);
    }
  }

  return {
    uploadFile,
  };
}
