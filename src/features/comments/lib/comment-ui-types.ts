import type { CommentNode } from "@/features/comments/server/comment-types";

export type CommentTargetType =
  | "course"
  | "section"
  | "teacher"
  | "section-teacher"
  | "homework";

export type CommentTargetOption = {
  key: string;
  label: string;
  sectionId?: number;
  targetId?: number | string | null;
  teacherId?: number | null;
  type: CommentTargetType;
};

export type CommentNodeWithContext = CommentNode & {
  contextKey?: string;
  contextLabel?: string;
  replies: CommentNodeWithContext[];
};

export type ReactionOption = {
  type: string;
  emoji: string;
};

export const COMMENT_REACTION_OPTIONS: ReactionOption[] = [
  { type: "upvote", emoji: "👍" },
  { type: "downvote", emoji: "👎" },
  { type: "heart", emoji: "❤️" },
  { type: "laugh", emoji: "😄" },
  { type: "hooray", emoji: "🎉" },
  { type: "confused", emoji: "😕" },
  { type: "rocket", emoji: "🚀" },
  { type: "eyes", emoji: "👀" },
];

export function withCommentContext(
  comment: CommentNode,
  context: CommentTargetOption,
  showAllTargets: boolean,
): CommentNodeWithContext {
  return {
    ...comment,
    contextKey: context.key,
    contextLabel: showAllTargets ? context.label : undefined,
    replies: comment.replies.map((reply) =>
      withCommentContext(reply, context, showAllTargets),
    ),
  };
}
