import { error, redirect } from "@sveltejs/kit";
import { getCommentsCopy } from "@/lib/comments-copy";
import { getPagePrisma } from "@/lib/page-data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const copy = getCommentsCopy(locals.locale);
  const prisma = await getPagePrisma(locals.locale);
  const comment = await prisma.comment.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      homework: { select: { id: true, section: { select: { jwId: true } } } },
      sectionTeacher: { select: { section: { select: { jwId: true } } } },
      section: { select: { jwId: true } },
      course: { select: { jwId: true } },
      teacher: { select: { id: true } },
    },
  });
  if (!comment) error(404, copy.comments.commentNotFound);
  const suffix = `#comment-${comment.id}`;
  if (comment.homework?.section?.jwId) {
    redirect(
      303,
      `/sections/${comment.homework.section.jwId}#homework-${comment.homework.id}`,
    );
  }
  if (comment.sectionTeacher?.section?.jwId) {
    redirect(303, `/sections/${comment.sectionTeacher.section.jwId}${suffix}`);
  }
  if (comment.section?.jwId) {
    redirect(303, `/sections/${comment.section.jwId}${suffix}`);
  }
  if (comment.course?.jwId) {
    redirect(303, `/courses/${comment.course.jwId}?tab=comments${suffix}`);
  }
  if (comment.teacher?.id) {
    redirect(303, `/teachers/${comment.teacher.id}?tab=comments${suffix}`);
  }
  error(404, copy.comments.commentTargetNotFound);
};
