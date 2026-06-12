import { getCommentsPayload } from "@/features/comments/server/comments-server";
import { getDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import { getViewerContext } from "@/lib/auth/viewer-context";

export async function getSectionDetailDescriptionAndComments(
  section: {
    id: number;
    course: { id: number };
    teachers: { id: number }[];
  },
  userId: string | null,
) {
  const descriptionViewer = await getViewerContext({ userId });
  const firstCommentTeacher = section.teachers[0] ?? null;
  const [descriptionData, sectionComments, courseComments, teacherComments] =
    await Promise.all([
      getDescriptionPayload("section", section.id, descriptionViewer),
      getCommentsPayload(
        { type: "section", targetId: section.id },
        descriptionViewer,
      ),
      getCommentsPayload(
        { type: "course", targetId: section.course.id },
        descriptionViewer,
      ),
      firstCommentTeacher
        ? getCommentsPayload(
            {
              type: "section-teacher",
              sectionId: section.id,
              teacherId: firstCommentTeacher.id,
            },
            descriptionViewer,
          )
        : Promise.resolve({
            comments: [],
            hiddenCount: 0,
            viewer: descriptionViewer,
          }),
    ]);

  return {
    commentsData: {
      commentMap: {
        course: courseComments.comments,
        section: sectionComments.comments,
        "section-teacher": teacherComments.comments,
      },
      hiddenCount:
        sectionComments.hiddenCount +
        courseComments.hiddenCount +
        teacherComments.hiddenCount,
      viewer: descriptionViewer,
    },
    descriptionData,
  };
}
