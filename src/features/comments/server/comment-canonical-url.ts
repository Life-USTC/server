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

  const suffix = `#comment-${comment.id}`;
  if (comment.homework?.section?.jwId) {
    return {
      ok: true,
      url: `/sections/${comment.homework.section.jwId}#homework-${comment.homework.id}`,
    };
  }
  if (comment.sectionTeacher?.section?.jwId) {
    return {
      ok: true,
      url: `/sections/${comment.sectionTeacher.section.jwId}${suffix}`,
    };
  }
  if (comment.section?.jwId) {
    return { ok: true, url: `/sections/${comment.section.jwId}${suffix}` };
  }
  if (comment.course?.jwId) {
    return {
      ok: true,
      url: `/courses/${comment.course.jwId}?tab=comments${suffix}`,
    };
  }
  if (comment.teacher?.id) {
    return {
      ok: true,
      url: `/teachers/${comment.teacher.id}?tab=comments${suffix}`,
    };
  }

  return { ok: false, reason: "target_not_found" };
}
