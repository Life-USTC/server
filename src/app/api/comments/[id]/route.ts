import {
  buildCommentNodes,
  type CommentNode,
} from "@/features/comments/server/comment-serialization";
import {
  badRequest,
  forbidden,
  handleRouteError,
  jsonResponse,
  notFound,
  parseResourceIdParam,
  parseRouteJsonBody,
  unauthorized,
} from "@/lib/api/helpers";
import { commentUpdateRequestSchema } from "@/lib/api/schemas/request-schemas";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { resolveApiUserId } from "@/lib/auth/helpers";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

function findComment(nodes: CommentNode[], id: string): CommentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findComment(node.replies ?? [], id);
    if (nested) return nested;
  }
  return null;
}

/**
 * Get one comment thread by comment ID.
 * @pathParams resourceIdPathParamsSchema
 * @response commentThreadResponseSchema
 * @response 404:openApiErrorSchema
 */
async function getRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await parseResourceIdParam(params, "comment");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;

  try {
    const viewerUserId = await resolveApiUserId(request);

    // Fetch the anchor comment and the viewer context in parallel.
    const [comment, viewer] = await Promise.all([
      prisma.comment.findUnique({
        where: { id },
        select: {
          sectionId: true,
          courseId: true,
          teacherId: true,
          sectionTeacherId: true,
          rootId: true,
          id: true,
          homework: {
            select: {
              id: true,
              title: true,
              section: {
                select: { jwId: true, code: true },
              },
            },
          },
          sectionTeacher: {
            select: {
              sectionId: true,
              teacherId: true,
              section: {
                select: {
                  jwId: true,
                  code: true,
                  course: {
                    select: { jwId: true, nameCn: true },
                  },
                },
              },
              teacher: {
                select: { nameCn: true },
              },
            },
          },
          section: {
            select: { jwId: true, code: true },
          },
          course: {
            select: { jwId: true, nameCn: true },
          },
          teacher: {
            select: { nameCn: true },
          },
        },
      }),
      getViewerContext({
        includeAdmin: false,
        userId: viewerUserId,
      }),
    ]);

    if (!comment) {
      return notFound();
    }

    const threadKey = comment.rootId ?? comment.id;

    const threadComments = await prisma.comment.findMany({
      where: {
        OR: [{ id: threadKey }, { rootId: threadKey }],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            isAdmin: true,
            accounts: {
              select: { provider: true },
            },
          },
        },
        attachments: {
          include: {
            upload: {
              select: {
                filename: true,
                contentType: true,
                size: true,
              },
            },
          },
        },
        reactions: {
          select: {
            type: true,
            userId: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const { roots, hiddenCount } = buildCommentNodes(threadComments, viewer);
    const focus = findComment(roots, id);

    if (!focus) {
      return forbidden();
    }

    return jsonResponse({
      thread: roots,
      focusId: id,
      hiddenCount,
      viewer,
      target: {
        sectionId: comment.sectionId ?? null,
        courseId: comment.courseId ?? null,
        teacherId: comment.teacherId ?? null,
        sectionTeacherId: comment.sectionTeacherId ?? null,
        sectionTeacherSectionId: comment.sectionTeacher?.sectionId ?? null,
        sectionTeacherTeacherId: comment.sectionTeacher?.teacherId ?? null,
        sectionTeacherSectionJwId:
          comment.sectionTeacher?.section?.jwId ?? null,
        sectionTeacherSectionCode:
          comment.sectionTeacher?.section?.code ?? null,
        sectionTeacherTeacherName:
          comment.sectionTeacher?.teacher?.nameCn ?? null,
        sectionTeacherCourseJwId:
          comment.sectionTeacher?.section?.course?.jwId ?? null,
        sectionTeacherCourseName:
          comment.sectionTeacher?.section?.course?.nameCn ?? null,
        homeworkId: comment.homework?.id ?? null,
        homeworkTitle: comment.homework?.title ?? null,
        homeworkSectionJwId: comment.homework?.section?.jwId ?? null,
        homeworkSectionCode: comment.homework?.section?.code ?? null,
        sectionJwId: comment.section?.jwId ?? null,
        sectionCode: comment.section?.code ?? null,
        courseJwId: comment.course?.jwId ?? null,
        courseName: comment.course?.nameCn ?? null,
        teacherName: comment.teacher?.nameCn ?? null,
      },
    });
  } catch (error) {
    return handleRouteError("Failed to fetch comment", error);
  }
}
export const GET = observedApiRoute(getRoute);

/**
 * Update one comment.
 * @pathParams resourceIdPathParamsSchema
 * @body commentUpdateRequestSchema
 * @response commentUpdateResponseSchema
 * @response 400:openApiErrorSchema
 */
async function patchRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await parseResourceIdParam(params, "comment");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;
  const parsedBody = await parseRouteJsonBody(
    request,
    commentUpdateRequestSchema,
    "Invalid comment update",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  // Use schema-parsed values directly — Zod already validated enums/booleans.
  const content = parsedBody.body;
  const visibility = parsedBody.visibility;
  const isAnonymous = parsedBody.isAnonymous;

  const hasAttachmentUpdate = Array.isArray(parsedBody.attachmentIds);
  const attachmentIds = hasAttachmentUpdate
    ? (parsedBody.attachmentIds ?? [])
    : [];

  try {
    const userId = await resolveApiUserId(request);
    if (!userId) {
      return unauthorized();
    }

    const viewer = await getViewerContext({ userId });
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true },
    });

    if (!comment) {
      return notFound();
    }

    if (String(comment.status) === "deleted") {
      return forbidden("Comment locked");
    }

    if (!viewer.isAdmin && comment.userId !== viewer.userId) {
      return forbidden();
    }

    if (hasAttachmentUpdate) {
      const uploads = await prisma.upload.findMany({
        where: {
          id: { in: attachmentIds },
          userId,
        },
        select: { id: true },
      });

      if (uploads.length !== attachmentIds.length) {
        return badRequest("Invalid attachments");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id },
        data: {
          body: content,
          visibility,
          isAnonymous,
        },
      });

      if (!hasAttachmentUpdate) {
        return;
      }

      if (attachmentIds.length > 0) {
        await tx.commentAttachment.deleteMany({
          where: {
            commentId: id,
            uploadId: { notIn: attachmentIds },
          },
        });

        await tx.commentAttachment.createMany({
          data: attachmentIds.map((uploadId) => ({
            uploadId,
            commentId: id,
          })),
          skipDuplicates: true,
        });
      } else {
        await tx.commentAttachment.deleteMany({
          where: {
            commentId: id,
          },
        });
      }
    });

    const updatedComment = await prisma.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            isAdmin: true,
            accounts: {
              select: { provider: true },
            },
          },
        },
        attachments: {
          include: {
            upload: {
              select: {
                filename: true,
                contentType: true,
                size: true,
              },
            },
          },
        },
        reactions: {
          select: {
            type: true,
            userId: true,
          },
        },
      },
    });

    if (!updatedComment) {
      return notFound();
    }

    const { roots } = buildCommentNodes([updatedComment], viewer);

    fireAuditLog({
      action: "comment_edit",
      userId,
      targetId: id,
      targetType: "comment",
      metadata: { body: content?.slice(0, 200) },
      ...getAuditRequestMetadata(request),
    });

    return jsonResponse({ success: true, comment: roots[0] });
  } catch (error) {
    return handleRouteError("Failed to update comment", error);
  }
}
export const PATCH = observedApiRoute(patchRoute);

/**
 * Delete one comment.
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 404:openApiErrorSchema
 */
async function deleteRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await parseResourceIdParam(params, "comment");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;

  try {
    const userId = await resolveApiUserId(request);
    if (!userId) {
      return unauthorized();
    }

    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!comment) {
      return notFound();
    }

    if (comment.userId !== userId) {
      return forbidden();
    }

    await prisma.comment.update({
      where: { id },
      data: {
        status: "deleted",
        deletedAt: new Date(),
      },
    });

    fireAuditLog({
      action: "comment_delete",
      userId,
      targetId: id,
      targetType: "comment",
      ...getAuditRequestMetadata(request),
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return handleRouteError("Failed to delete comment", error);
  }
}
export const DELETE = observedApiRoute(deleteRoute);
