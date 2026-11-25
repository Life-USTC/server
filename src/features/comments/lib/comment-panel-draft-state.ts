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
