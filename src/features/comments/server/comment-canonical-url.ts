import {
  commentPermalinkHref,
  commentTargetPermalinkBaseHref,
} from "@/features/comments/lib/comment-panel-links";
import { getPrisma } from "@/lib/db/prisma";

type CommentCanonicalUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not_found" | "target_not_found" };

export async function resolveCommentCanonicalUrl(
  commentId: string,
  locale: string,
): Promise<CommentCanonicalUrlResult> {
  const prisma = getPrisma(locale);
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      homework: { select: { id: true, section: { select: { jwId: true } } } },
      sectionTeacher: { select: { section: { select: { jwId: true } } } },
      section: { select: { jwId: true } },
      course: { select: { jwId: true } },
      teacher: { select: { id: true } },
    },
  });

  if (!comment) return { ok: false, reason: "not_found" };

  if (comment.homework?.section?.jwId) {
    return {
      ok: true,
      url: commentPermalinkHref(
        commentTargetPermalinkBaseHref({
          homeworkId: comment.homework.id,
          sectionJwId: comment.homework.section.jwId,
          type: "homework",
        }),
        comment.id,
      ),
    };
  }
  if (comment.sectionTeacher?.section?.jwId) {
    return {
      ok: true,
      url: commentPermalinkHref(
        commentTargetPermalinkBaseHref({
          sectionJwId: comment.sectionTeacher.section.jwId,
          type: "section-teacher",
        }),
        comment.id,
      ),
    };
  }
  if (comment.section?.jwId) {
    return {
      ok: true,
      url: commentPermalinkHref(
        commentTargetPermalinkBaseHref({
          sectionJwId: comment.section.jwId,
          type: "section",
        }),
        comment.id,
      ),
    };
  }
  if (comment.course?.jwId) {
    return {
      ok: true,
      url: commentPermalinkHref(
        commentTargetPermalinkBaseHref({
          courseJwId: comment.course.jwId,
          type: "course",
        }),
        comment.id,
      ),
    };
  }
  if (comment.teacher?.id) {
    return {
      ok: true,
      url: commentPermalinkHref(
        commentTargetPermalinkBaseHref({
          teacherId: comment.teacher.id,
          type: "teacher",
        }),
        comment.id,
      ),
    };
  }

  return { ok: false, reason: "target_not_found" };
}
