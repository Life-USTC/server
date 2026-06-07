import type { Prisma } from "@/generated/prisma/client";
import {
  badRequest,
  forbidden,
  handleRouteError,
  jsonResponse,
  notFound,
  parseResourceIdParam,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { homeworkUpdateRequestSchema } from "@/lib/api/schemas/request-schemas";
import { requireWriteAuth } from "@/lib/auth/helpers";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { parseDateInput } from "@/lib/time/parse-date-input";

export const dynamic = "force-dynamic";

/**
 * Update one homework.
 * @pathParams resourceIdPathParamsSchema
 * @body homeworkUpdateRequestSchema
 * @response successResponseSchema
 * @response 400:openApiErrorSchema
 */
async function patchRoute(
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
    homeworkUpdateRequestSchema,
    "Invalid homework update",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const title = parsedBody.title;

  const hasPublishedAt = Object.hasOwn(parsedBody, "publishedAt");
  const hasSubmissionStartAt = Object.hasOwn(parsedBody, "submissionStartAt");
  const hasSubmissionDueAt = Object.hasOwn(parsedBody, "submissionDueAt");

  const publishedAt = hasPublishedAt
    ? parseDateInput(parsedBody.publishedAt)
    : undefined;
  const submissionStartAt = hasSubmissionStartAt
    ? parseDateInput(parsedBody.submissionStartAt)
    : undefined;
  const submissionDueAt = hasSubmissionDueAt
    ? parseDateInput(parsedBody.submissionDueAt)
    : undefined;

  if (hasPublishedAt && publishedAt === undefined) {
    return badRequest("Invalid publish date");
  }
  if (hasSubmissionStartAt && submissionStartAt === undefined) {
    return badRequest("Invalid submission start");
  }
  if (hasSubmissionDueAt && submissionDueAt === undefined) {
    return badRequest("Invalid submission due");
  }

  if (
    submissionStartAt &&
    submissionDueAt &&
    submissionStartAt.getTime() > submissionDueAt.getTime()
  ) {
    return badRequest("Submission start must be before due");
  }

  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  try {
    const homework = await prisma.homework.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!homework) {
      return notFound();
    }

    if (homework.deletedAt) {
      return forbidden("Homework deleted");
    }

    const updates: Prisma.HomeworkUpdateInput = {
      updatedBy: { connect: { id: userId } },
    };

    if (title !== undefined) updates.title = title;
    if (parsedBody.isMajor !== undefined) {
      updates.isMajor = parsedBody.isMajor === true;
    }
    if (parsedBody.requiresTeam !== undefined) {
      updates.requiresTeam = parsedBody.requiresTeam === true;
    }
    if (publishedAt !== undefined) updates.publishedAt = publishedAt;
    if (submissionStartAt !== undefined) {
      updates.submissionStartAt = submissionStartAt;
    }
    if (submissionDueAt !== undefined)
      updates.submissionDueAt = submissionDueAt;

    // Only count user-provided fields; `updatedBy` is always present.
    const userFieldCount = [
      title !== undefined,
      parsedBody.isMajor !== undefined,
      parsedBody.requiresTeam !== undefined,
      hasPublishedAt,
      hasSubmissionStartAt,
      hasSubmissionDueAt,
    ].filter(Boolean).length;

    if (userFieldCount === 0) {
      return badRequest("No changes");
    }

    await prisma.homework.update({
      where: { id },
      data: updates,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return handleRouteError("Failed to update homework", error);
  }
}
export const PATCH = observedApiRoute(patchRoute);

/**
 * Soft delete one homework.
 * @pathParams resourceIdPathParamsSchema
 * @response successResponseSchema
 * @response 404:openApiErrorSchema
 */
async function deleteRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await parseResourceIdParam(params, "homework");
  if (parsed instanceof Response) {
    return parsed;
  }
  const id = parsed;
  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  try {
    const viewer = await getViewerContext({
      includeAdmin: true,
      userId,
    });
    const homework = await prisma.homework.findUnique({
      where: { id },
      select: { id: true, title: true, createdById: true, sectionId: true },
    });

    if (!homework) {
      return notFound();
    }

    if (!viewer.isAdmin && homework.createdById !== userId) {
      return forbidden();
    }

    await prisma.$transaction(async (tx) => {
      await tx.homework.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: userId,
          updatedById: userId,
        },
      });

      await tx.homeworkAuditLog.create({
        data: {
          action: "deleted",
          sectionId: homework.sectionId,
          homeworkId: homework.id,
          actorId: userId,
          titleSnapshot: homework.title,
        },
      });
    });

    return jsonResponse({ success: true });
  } catch (error) {
    return handleRouteError("Failed to delete homework", error);
  }
}
export const DELETE = observedApiRoute(deleteRoute);
