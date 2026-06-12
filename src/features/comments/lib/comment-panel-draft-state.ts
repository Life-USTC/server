import type { CommentNode } from "../server/comment-types";
import type { CommentUploadOption } from "./comment-upload-client";

export type CommentEditorMode = "edit" | "new" | "reply";

export function commentEditAttachmentOptions(
  comment: CommentNode,
  editUploadedFiles: CommentUploadOption[],
  editAttachmentIds: string[],
) {
  const existingUploads = comment.attachments.map((attachment) => ({
    id: attachment.uploadId,
    filename: attachment.filename,
    size: attachment.size,
  }));
  const uploads = [...existingUploads, ...editUploadedFiles];
  return uploads.filter((upload, index) => {
    if (!editAttachmentIds.includes(upload.id)) return false;
    return uploads.findIndex((item) => item.id === upload.id) === index;
  });
}

export function commentDraftWithMarkdown(input: {
  appendMarkdown: (value: string, currentValue: string) => string;
  body: string;
  editDraft: string;
  mode: CommentEditorMode;
  replyDraft: string;
  value: string;
}) {
  return updateDraftForMode(
    input.mode,
    {
      body: input.body,
      editDraft: input.editDraft,
      replyDraft: input.replyDraft,
    },
    (draft) => input.appendMarkdown(input.value, draft),
  );
}

export function commentDraftReplacingToken(input: {
  body: string;
  editDraft: string;
  mode: CommentEditorMode;
  replyDraft: string;
  replacement: string;
  token: string;
}) {
  return updateDraftForMode(
    input.mode,
    {
      body: input.body,
      editDraft: input.editDraft,
      replyDraft: input.replyDraft,
    },
    (draft) => draft.replace(input.token, input.replacement),
  );
}

export function commentAttachmentStateWithUpload(input: {
  editAttachmentIds: string[];
  editUploadedFiles: CommentUploadOption[];
  mode: CommentEditorMode;
  replyAttachmentIds: string[];
  replyUploadedFiles: CommentUploadOption[];
  selectedAttachments: string[];
  upload: CommentUploadOption;
  uploadedFiles: CommentUploadOption[];
}) {
  if (input.mode === "edit") {
    return {
      editAttachmentIds: [...input.editAttachmentIds, input.upload.id],
      editUploadedFiles: [...input.editUploadedFiles, input.upload],
      replyAttachmentIds: input.replyAttachmentIds,
      replyUploadedFiles: input.replyUploadedFiles,
      selectedAttachments: input.selectedAttachments,
      uploadedFiles: input.uploadedFiles,
    };
  }
  if (input.mode === "reply") {
    return {
      editAttachmentIds: input.editAttachmentIds,
      editUploadedFiles: input.editUploadedFiles,
      replyAttachmentIds: [...input.replyAttachmentIds, input.upload.id],
      replyUploadedFiles: [...input.replyUploadedFiles, input.upload],
      selectedAttachments: input.selectedAttachments,
      uploadedFiles: input.uploadedFiles,
    };
  }
  return {
    editAttachmentIds: input.editAttachmentIds,
    editUploadedFiles: input.editUploadedFiles,
    replyAttachmentIds: input.replyAttachmentIds,
    replyUploadedFiles: input.replyUploadedFiles,
    selectedAttachments: [...input.selectedAttachments, input.upload.id],
    uploadedFiles: [...input.uploadedFiles, input.upload],
  };
}

function updateDraftForMode(
  mode: CommentEditorMode,
  drafts: {
    body: string;
    editDraft: string;
    replyDraft: string;
  },
  update: (draft: string) => string,
) {
  if (mode === "edit") {
    return { ...drafts, editDraft: update(drafts.editDraft) };
  }
  if (mode === "reply") {
    return { ...drafts, replyDraft: update(drafts.replyDraft) };
  }
  return { ...drafts, body: update(drafts.body) };
}
