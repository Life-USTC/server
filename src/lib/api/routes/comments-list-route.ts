import { loadCommentThread } from "@/features/comments/server/comment-read-model";
import { commentListTargetPayload } from "@/features/comments/server/comment-target-payload";
import { resolveCommentTargetReference } from "@/features/comments/server/comment-target-resolution";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import {
  badRequest,
  buildPaginatedResponse,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { commentsQuerySchema } from "@/lib/api/schemas/request-schemas";
import { resolveSessionUserId } from "@/lib/auth/api-auth";

export async function getCommentsRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseRouteQuery(
    searchParams,
    commentsQuerySchema,
    "Invalid target",
    { pagination: { defaultPageSize: 20, maxPageSize: 100 } },
  );
  if (parsed instanceof Response) {
    return parsed;
  }
  const { pagination, query: parsedQuery } = parsed;

  const targetType = parsedQuery.targetType;
  const targetIdParam = parsedQuery.targetId ?? null;

  try {
    const resolved = await runCloudflareTraceSpan(
      "target.resolve",
      { targetType },
      () =>
        resolveCommentTargetReference({
          allowDirectSectionTeacherId: true,
          courseJwId: parsedQuery.courseJwId,
          homeworkId: parsedQuery.homeworkId,
          rawTargetId: targetIdParam,
          sectionId: parsedQuery.sectionId,
          sectionJwId: parsedQuery.sectionJwId,
          sectionTeacherId: parsedQuery.sectionTeacherId,
          targetType,
          teacherId: parsedQuery.teacherId,
          verifyExistence: true,
          includeTargetMetadata: true,
        }),
    );
    if (!resolved.ok && resolved.error === "invalid_target") {
      return badRequest("Invalid target");
    }
    if (!resolved.ok) {
      return notFound();
    }

    const viewerUserId = await resolveSessionUserId(request);
    const { comments, hiddenCount, total, viewer } = await loadCommentThread({
      pagination,
      target: resolved.target,
      viewerUserId,
    });
    const response = buildPaginatedResponse(
      comments,
      pagination.page,
      pagination.pageSize,
      total,
    );

    return jsonResponse({
      ...response,
      meta: {
        hiddenCount,
        viewer,
        target: await runCloudflareTraceSpan(
          "target.payload",
          { targetType },
          () => commentListTargetPayload(targetType, resolved.target),
        ),
      },
    });
  } catch (error) {
    return handleRouteError("Failed to fetch comments", error);
  }
}
