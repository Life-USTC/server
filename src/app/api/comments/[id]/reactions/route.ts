import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseResourceIdParam,
  parseRouteJsonBody,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { commentReactionRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth, requireWriteAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Add one reaction to a comment.
 * @pathParams resourceIdPathParamsSchema
 * @body commentReactionRequestSchema
 * @response 200:successResponseSchema
 */
async function postRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  const parsed = await parseResourceIdParam(params, "comment");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;
  const parsedBody = await parseRouteJsonBody(
    request,
    commentReactionRequestSchema,
    "Invalid reaction",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }
  const type = parsedBody.type;

  try {
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!comment) {
      return notFound();
    }

    await prisma.commentReaction.upsert({
      where: {
        commentId_userId_type: {
          commentId: id,
          userId,
          type,
        },
      },
      update: {},
      create: {
        commentId: id,
        userId,
        type,
      },
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return handleRouteError("Failed to add reaction", error);
  }
}
export const POST = observedApiRoute(postRoute);

/**
 * Remove one reaction from a comment.
 * @pathParams resourceIdPathParamsSchema
 * @params commentReactionRequestSchema
 * @response 200:successResponseSchema
 */
async function deleteRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsed = await parseResourceIdParam(params, "comment");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;
  const { searchParams } = new URL(request.url);
  const parsedBody = parseRouteSearchParams(
    searchParams,
    commentReactionRequestSchema,
    "Invalid reaction",
    { logErrors: true },
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }
  const type = parsedBody.type;

  try {
    await prisma.commentReaction.deleteMany({
      where: {
        commentId: id,
        userId,
        type,
      },
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return handleRouteError("Failed to remove reaction", error);
  }
}
export const DELETE = observedApiRoute(deleteRoute);
