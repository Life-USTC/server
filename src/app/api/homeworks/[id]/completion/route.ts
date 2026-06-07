import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseResourceIdParam,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { homeworkCompletionRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Update completion state for one homework.
 * @pathParams resourceIdPathParamsSchema
 * @body homeworkCompletionRequestSchema
 * @response homeworkCompletionResponseSchema
 * @response 400:openApiErrorSchema
 */
async function putRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await parseResourceIdParam(params, "homework");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;
  const parsedBody = await parseRouteJsonBody(
    request,
    homeworkCompletionRequestSchema,
    "Invalid completion payload",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    const homework = await prisma.homework.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!homework || homework.deletedAt) {
      return notFound();
    }

    if (parsedBody.completed) {
      const completion = await prisma.homeworkCompletion.upsert({
        where: { userId_homeworkId: { userId, homeworkId: id } },
        update: { completedAt: new Date() },
        create: { userId, homeworkId: id },
      });

      return jsonResponse({
        completed: true,
        completedAt: completion.completedAt,
      });
    }

    await prisma.homeworkCompletion.deleteMany({
      where: { userId, homeworkId: id },
    });

    return jsonResponse({ completed: false, completedAt: null });
  } catch (error) {
    return handleRouteError("Failed to update completion", error);
  }
}

export const PUT = observedApiRoute(putRoute);
