import type { CommentTargetOption } from "@/features/comments/lib/comment-ui";
import type { getCommentsCopy } from "../lib/comments-copy";

export type CommentUploadOption = {
  id: string;
  filename: string;
  size?: number;
};

export type CommentsCopy = ReturnType<typeof getCommentsCopy>["comments"];
export type UploadsCopy = ReturnType<typeof getCommentsCopy>["uploads"];

export type CommentSelectOption = {
  label: string;
  value: string;
};

export type SubmitComment = (
  parentId?: string | null,
  replyBody?: string,
  target?: CommentTargetOption | null,
) => void;
