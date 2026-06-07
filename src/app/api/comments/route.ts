import { buildCommentNodes } from "@/features/comments/server/comment-serialization";
import { resolveCommentTarget } from "@/features/comments/server/comment-utils";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  commentCreateRequestSchema,
  commentsQuerySchema,
} from "@/lib/api/schemas/request-schemas";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { requireWriteAuth, resolveApiUserId } from "@/lib/auth/helpers";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * List comments for a target.
 * @params commentsQuerySchema
 * @response commentsListResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedQuery = parseRouteSearchParams(
    searchParams,
    commentsQuerySchema,
    "Invalid target",
  );
  if (parsedQuery instanceof Response) {
    return badRequest("Invalid target");
  }

  const targetType = parsedQuery.targetType;
  const targetIdParam = parsedQuery.targetId ?? null;

  try {
    const target = await resolveCommentTarget({
      allowDirectSectionTeacherId: true,
      rawTargetId: targetIdParam,
      sectionId: parsedQuery.sectionId,
      targetType,
      teacherId: parsedQuery.teacherId,
    });
    if (!target) {
      return badRequest("Invalid target");
    }

    const viewerUserId = await resolveApiUserId(request);
    const [viewer, comments] = await Promise.all([
      getViewerContext({ includeAdmin: false, userId: viewerUserId }),
      prisma.comment.findMany({
        where: target.whereTarget,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              isAdmin: true,
              accounts: {
                select: {
                  provider: true,
                },
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
      }),
    ]);

    const { roots, hiddenCount } = buildCommentNodes(comments, viewer);

    return jsonResponse({
      comments: roots,
      hiddenCount,
      viewer,
      target: {
        type: targetType,
        targetId: target.targetId,
        sectionId: target.sectionId,
        teacherId: target.teacherId,
        sectionTeacherId: target.sectionTeacherId,
        homeworkId: target.homeworkId,
      },
    });
  } catch (error) {
    return handleRouteError("Failed to fetch comments", error);
  }
}
export const GET = observedApiRoute(getRoute);

/**
 * Create one comment.
 * @body commentCreateRequestSchema
 * @response idResponseSchema
 * @response 400:openApiErrorSchema
 */
async function postRoute(request: Request) {
  const parsedBody = await parseRouteJsonBody(
    request,
    commentCreateRequestSchema,
    "Invalid comment request",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const targetType = parsedBody.targetType;
  const content = parsedBody.body;

  // Use schema-parsed values directly — Zod already validated the enum/boolean.
  const visibility = parsedBody.visibility ?? "public";
  const isAnonymous = parsedBody.isAnonymous === true;

  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  try {
    const target = await resolveCommentTarget({
      rawTargetId: parsedBody.targetId,
      sectionId: parsedBody.sectionId,
      targetType,
      teacherId: parsedBody.teacherId,
      // Verify target entity exists to prevent orphan comments on deleted targets.
      verifyExistence: true,
    });
    if (!target) {
      return badRequest("Invalid target");
    }
    if (!target.verified) {
      return notFound("Target not found");
    }

    let parentId: string | null = null;
    let rootId: string | null = null;
    if (parsedBody.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parsedBody.parentId },
      });
      if (!parent) {
        return notFound("Parent not found");
      }

      const sameTarget = Object.entries(target.whereTarget).every(
        ([key, value]) => parent[key as keyof typeof parent] === value,
      );
      if (!sameTarget) {
        return badRequest("Parent target mismatch");
      }
      parentId = parent.id;
      rootId = parent.rootId ?? parent.id;
    }

    const comment = await prisma.comment.create({
      data: {
        body: content,
        visibility,
        status: "active",
        isAnonymous,
        authorName: null,
        userId,
        parentId,
        rootId,
        ...target.whereTarget,
      },
    });

    if (!rootId) {
      await prisma.comment.update({
        where: { id: comment.id },
        data: { rootId: comment.id },
      });
    }

    const attachmentIds = parsedBody.attachmentIds ?? [];

    if (attachmentIds.length > 0) {
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

      await prisma.commentAttachment.createMany({
        data: attachmentIds.map((uploadId) => ({
          uploadId,
          commentId: comment.id,
        })),
        skipDuplicates: true,
      });
    }

    fireAuditLog({
      action: "comment_create",
      userId,
      targetId: comment.id,
      targetType: "comment",
      metadata: { body: content.slice(0, 200) },
      ...getAuditRequestMetadata(request),
    });

    return jsonResponse({ id: comment.id });
  } catch (error) {
    return handleRouteError("Failed to create comment", error);
  }
}
export const POST = observedApiRoute(postRoute);
