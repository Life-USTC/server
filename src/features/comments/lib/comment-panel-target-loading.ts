import {
  type CommentNodeWithContext,
  type CommentTargetOption,
  withCommentContext,
} from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { ViewerContext } from "@/lib/auth/viewer-context";

export type LoadedCommentTargetData = {
  comments: CommentNode[];
  hiddenCount: number;
  viewer?: ViewerContext;
};

export type LoadedCommentTargetEntry = {
  data: LoadedCommentTargetData;
  target: CommentTargetOption;
};

export function commentTargetCanLoad(target: CommentTargetOption) {
  return target.type !== "section-teacher" || target.teacherId;
}

export function commentTargetSearchParams(target: CommentTargetOption) {
  const params = new URLSearchParams({ targetType: target.type });
  setNullableParam(params, "targetId", target.targetId);
  setNullableParam(params, "sectionId", target.sectionId);
  setNullableParam(params, "teacherId", target.teacherId);
  return params;
}

export function visibleCommentsForTargets({
  showAllTargets,
  targetComments,
  targets,
}: {
  showAllTargets: boolean;
  targetComments: Record<string, CommentNodeWithContext[]>;
  targets: CommentTargetOption[];
}) {
  return showAllTargets
    ? targets.flatMap((target) => targetComments[target.key] ?? [])
    : (targetComments[targets[0]?.key ?? ""] ?? []);
}

export function commentTargetEntriesResult({
  entries,
  showAllTargets,
  targets,
}: {
  entries: LoadedCommentTargetEntry[];
  showAllTargets: boolean;
  targets: CommentTargetOption[];
}) {
  const targetComments: Record<string, CommentNodeWithContext[]> = {};
  let hiddenCount = 0;

  for (const entry of entries) {
    targetComments[entry.target.key] = entry.data.comments.map((comment) =>
      withCommentContext(comment, entry.target, showAllTargets),
    );
    hiddenCount += entry.data.hiddenCount;
  }

  return {
    comments: visibleCommentsForTargets({
      showAllTargets,
      targetComments,
      targets,
    }),
    hiddenCount,
    viewer: entries[0]?.data.viewer,
  };
}

function setNullableParam(
  params: URLSearchParams,
  key: string,
  value: number | string | null | undefined,
) {
  if (value !== null && value !== undefined) {
    params.set(key, String(value));
  }
}
