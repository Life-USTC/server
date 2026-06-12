import {
  forbidden,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteInput,
} from "@/lib/api/helpers";
import {
  buildCommentRouteTarget,
  commentTargetLookupSelect,
  commentThreadInclude,
  findComment,
} from "@/lib/api/routes/comments-read-helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function getCommentRoute(request: Request, params: IdParams) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid comment ID",
  );
  if (parsedParams instanceof Response) {
    return parsedParams;
  }
  const id = parsedParams.id;

  try {
    const viewerUserId = await resolveApiUserId(request);
    const [{ getViewerContext }, { prisma }, { buildCommentNodes }] =
      await Promise.all([
        import("@/lib/auth/viewer-context"),
        import("@/lib/db/prisma"),
        import("@/features/comments/server/comment-serialization"),
      ]);

    const [comment, viewer] = await Promise.all([
      prisma.comment.findUnique({
        where: { id },
        select: commentTargetLookupSelect,
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
      include: commentThreadInclude,
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
      target: buildCommentRouteTarget(comment),
    });
  } catch (error) {
    return handleRouteError("Failed to fetch comment", error);
  }
}
