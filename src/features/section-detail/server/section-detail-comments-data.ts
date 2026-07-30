import { getCommentsPayload } from "@/features/comments/server/comments-server";
import { emptyDescriptionPayload } from "@/features/descriptions/server/description-payload";
import { getDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import { getViewerContext } from "@/lib/auth/viewer-context";

export async function getSectionDetailDescriptionAndComments(
  section: {
    id: number;
    course: { id: number };
    teachers: { id: number }[];
  },
  userId: string | null,
  {
    includeComments,
    includeDescription,
    includeDescriptionHistory,
  }: {
    includeComments: boolean;
    includeDescription: boolean;
    includeDescriptionHistory: boolean;
  },
) {
  const descriptionViewer = await getViewerContext({ userId });
  const descriptionDataPromise = includeDescription
    ? getDescriptionPayload("section", section.id, descriptionViewer, {
        includeHistory: includeDescriptionHistory,
      })
    : Promise.resolve(emptyDescriptionPayload(descriptionViewer));
  if (!includeComments) {
    return {
      commentsData: null,
      descriptionData: await descriptionDataPromise,
    };
  }
  const firstCommentTeacher = section.teachers[0] ?? null;
  const [descriptionData, sectionComments, courseComments, teacherComments] =
    await Promise.all([
      descriptionDataPromise,
      getCommentsPayload(
        { type: "section", targetId: section.id },
        descriptionViewer,
        { pageSize: 20 },
      ),
      getCommentsPayload(
        { type: "course", targetId: section.course.id },
        descriptionViewer,
        { pageSize: 20 },
      ),
      firstCommentTeacher
        ? getCommentsPayload(
            {
              type: "section-teacher",
              sectionId: section.id,
              teacherId: firstCommentTeacher.id,
            },
            descriptionViewer,
            { pageSize: 20 },
          )
        : Promise.resolve({
            comments: [],
            complete: true,
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
      complete:
        sectionComments.complete &&
        courseComments.complete &&
        teacherComments.complete,
      viewer: descriptionViewer,
    },
    descriptionData,
  };
}
