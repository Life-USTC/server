import type { Prisma } from "@/generated/prisma/client";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseInteger,
  parseRouteJsonBody,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  homeworkCreateRequestSchema,
  homeworksQuerySchema,
} from "@/lib/api/schemas/request-schemas";
import { requireWriteAuth, resolveApiUserId } from "@/lib/auth/helpers";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { getPrisma, prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { parseDateInput } from "@/lib/time/parse-date-input";

export const dynamic = "force-dynamic";

/**
 * List homeworks by section.
 * @params homeworksQuerySchema
 * @response homeworksListResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedQuery = parseRouteSearchParams(
    searchParams,
    homeworksQuerySchema,
    "Invalid homework query",
    { logErrors: true },
  );
  if (parsedQuery instanceof Response) {
    return parsedQuery;
  }

  // Support single sectionId or comma-separated sectionIds
  const sectionIdList: number[] = [];
  if (parsedQuery.sectionIds) {
    for (const s of parsedQuery.sectionIds.split(",")) {
      const id = parseInteger(s.trim());
      if (id) sectionIdList.push(id);
    }
  } else if (parsedQuery.sectionId) {
    const id = parseInteger(parsedQuery.sectionId);
    if (id) sectionIdList.push(id);
  }

  if (sectionIdList.length === 0) {
    return badRequest("Invalid section — provide sectionId or sectionIds");
  }

  const includeDeleted = parsedQuery.includeDeleted === "true";
  const sectionFilter =
    sectionIdList.length === 1
      ? { sectionId: sectionIdList[0] }
      : { sectionId: { in: sectionIdList } };

  try {
    const viewerUserId = await resolveApiUserId(request);
    const viewer = await getViewerContext({
      includeAdmin: true,
      userId: viewerUserId,
    });
    const homeworkInclude = {
      section: {
        include: {
          course: true,
          semester: true,
        },
      },
      description: true,
      createdBy: {
        select: { id: true, name: true, username: true, image: true },
      },
      updatedBy: {
        select: { id: true, name: true, username: true, image: true },
      },
      deletedBy: {
        select: { id: true, name: true, username: true, image: true },
      },
      _count: {
        select: {
          comments: { where: { status: { not: "deleted" } } },
        },
      },
      ...(viewer.userId
        ? {
            homeworkCompletions: {
              where: { userId: viewer.userId },
              select: { completedAt: true },
            },
          }
        : {}),
    } satisfies Prisma.HomeworkInclude;

    const [homeworks, auditLogs] = await Promise.all([
      getPrisma("zh-cn").homework.findMany({
        where: {
          ...sectionFilter,
          ...(includeDeleted ? {} : { deletedAt: null }),
        },
        include: homeworkInclude,
        orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
      }),
      prisma.homeworkAuditLog.findMany({
        where:
          sectionIdList.length === 1
            ? { sectionId: sectionIdList[0] }
            : { sectionId: { in: sectionIdList } },
        include: {
          actor: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const responseHomeworks = homeworks.map((homework) => {
      const { homeworkCompletions, _count, ...rest } = homework;
      return {
        ...rest,
        completion: homeworkCompletions?.[0] ?? null,
        commentCount: _count.comments,
      };
    });

    return jsonResponse({
      viewer,
      homeworks: responseHomeworks,
      auditLogs,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch homeworks", error);
  }
}
export const GET = observedApiRoute(getRoute);

/**
 * Create one homework.
 * @body homeworkCreateRequestSchema
 * @response idResponseSchema
 * @response 400:openApiErrorSchema
 */
async function postRoute(request: Request) {
  const parsedBody = await parseRouteJsonBody(
    request,
    homeworkCreateRequestSchema,
    "Invalid homework request",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const sectionId = parseInteger(parsedBody.sectionId);

  if (!sectionId) {
    return badRequest("Invalid section");
  }

  const title = parsedBody.title;
  const description = (parsedBody.description ?? "").trim();

  const publishedAt = parseDateInput(parsedBody.publishedAt);
  const submissionStartAt = parseDateInput(parsedBody.submissionStartAt);
  const submissionDueAt = parseDateInput(parsedBody.submissionDueAt);

  if (publishedAt === undefined) {
    return badRequest("Invalid publish date");
  }
  if (submissionStartAt === undefined) {
    return badRequest("Invalid submission start");
  }
  if (submissionDueAt === undefined) {
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
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      select: { id: true },
    });

    if (!section) {
      return notFound("Section not found");
    }

    const result = await prisma.$transaction(async (tx) => {
      const homework = await tx.homework.create({
        data: {
          sectionId,
          title,
          isMajor: parsedBody.isMajor === true,
          requiresTeam: parsedBody.requiresTeam === true,
          publishedAt,
          submissionStartAt,
          submissionDueAt,
          createdById: userId,
          updatedById: userId,
        },
      });

      if (description) {
        const descriptionRecord = await tx.description.create({
          data: {
            content: description,
            lastEditedAt: new Date(),
            lastEditedById: userId,
            homeworkId: homework.id,
          },
        });

        await tx.descriptionEdit.create({
          data: {
            descriptionId: descriptionRecord.id,
            editorId: userId,
            previousContent: null,
            nextContent: description,
          },
        });
      }

      await tx.homeworkAuditLog.create({
        data: {
          action: "created",
          sectionId,
          homeworkId: homework.id,
          actorId: userId,
          titleSnapshot: title,
        },
      });

      return homework;
    });

    return jsonResponse({ id: result.id });
  } catch (error) {
    return handleRouteError("Failed to create homework", error);
  }
}
export const POST = observedApiRoute(postRoute);
