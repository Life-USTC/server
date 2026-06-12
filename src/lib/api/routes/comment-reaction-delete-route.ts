import {
  handleRouteError,
  jsonResponse,
  parseRouteInput,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  commentReactionRequestSchema,
  resourceIdPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function deleteCommentReactionRoute(
  request: Request,
  params: IdParams,
) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid comment ID",
  );
  if (parsedParams instanceof Response) {
    return parsedParams;
  }
  const id = parsedParams.id;
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
    const { prisma } = await import("@/lib/db/prisma");
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
