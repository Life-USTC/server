import type { CommentTargetType, ResolvedCommentTarget } from "./comment-utils";

export type CommentTargetReferenceInput = {
  allowDirectSectionTeacherId?: boolean;
  courseJwId?: unknown;
  homeworkId?: string;
  rawTargetId?: unknown;
  sectionId?: unknown;
  sectionJwId?: unknown;
  sectionTeacherId?: unknown;
  targetType: CommentTargetType;
  teacherId?: unknown;
  verifyExistence?: boolean;
  /** Select the public target payload while verifying the target. */
  includeTargetMetadata?: boolean;
};

export type ResolvedCommentTargetReference =
  | {
      ok: true;
      target: ResolvedCommentTarget;
      targetType: CommentTargetType;
    }
  | {
      ok: false;
      error: "invalid_target" | "target_not_found";
      targetId: unknown;
      targetType: CommentTargetType | string;
    };

export type UnresolvedCommentTargetReference = Extract<
  ResolvedCommentTargetReference,
  { ok: false }
>;

export type ResolvedCommentMutationTarget =
  | {
      ok: true;
      rawTargetId: unknown;
      sectionId?: unknown;
      teacherId?: unknown;
    }
  | Extract<ResolvedCommentTargetReference, { ok: false }>;
