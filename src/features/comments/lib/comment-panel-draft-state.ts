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
