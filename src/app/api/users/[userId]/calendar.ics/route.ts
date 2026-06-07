import { type NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  handleRouteError,
  invalidParamResponse,
  notFound,
  parseRouteParams,
  unauthorized,
} from "@/lib/api/helpers";
import { userCalendarPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { createUserCalendar } from "@/lib/ical";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

function parseUserCalendarIdentifier(rawUserId: string) {
  const separatorIndex = rawUserId.indexOf(":");
  if (separatorIndex === -1) {
    return {
      userId: rawUserId,
      tokenFromPath: null,
    };
  }

  return {
    userId: rawUserId.slice(0, separatorIndex),
    tokenFromPath: rawUserId.slice(separatorIndex + 1),
  };
}

/**
 * Generate calendar ICS for a user's subscribed sections and personal deadlines.
 * @pathParams userCalendarPathParamsSchema
 * @response 200:binary
 * @response 401:openApiErrorSchema
 * @response 403:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
async function getRoute(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const parsedParams = await parseRouteParams(
      context.params,
      userCalendarPathParamsSchema,
      "Invalid user ID",
    );
    if (parsedParams instanceof Response) {
      return invalidParamResponse("user ID");
    }

    const { userId: rawUserId } = parsedParams;
    const { userId, tokenFromPath } = parseUserCalendarIdentifier(rawUserId);
    const token =
      tokenFromPath?.trim() ||
      new URL(request.url).searchParams.get("token")?.trim();

    // Fetch full user data in one query; auth check happens after.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscribedSections: {
          include: {
            course: true,
            schedules: {
              include: {
                room: {
                  include: {
                    building: {
                      include: {
                        campus: true,
                      },
                    },
                  },
                },
                teachers: true,
              },
            },
            exams: {
              include: {
                examRooms: true,
              },
            },
          },
        },
        todos: {
          where: {
            completed: false,
            dueAt: { not: null },
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          select: {
            id: true,
            title: true,
            content: true,
            dueAt: true,
            priority: true,
          },
        },
      },
    });

    if (token) {
      if (!user || user.calendarFeedToken !== token) {
        return forbidden("Invalid or unauthorized token");
      }
    } else {
      const viewerUserId = await resolveApiUserId(request);
      if (!viewerUserId) {
        return unauthorized();
      }

      if (viewerUserId !== userId) {
        return forbidden("You can only access your own calendar");
      }

      if (!user) {
        return notFound("User not found");
      }
    }

    // TypeScript narrowing: user is non-null past this point (both paths check it).
    if (!user) {
      return notFound("User not found");
    }

    const sectionIds = user.subscribedSections.map((section) => section.id);
    const homeworks = sectionIds.length
      ? await prisma.homework.findMany({
          where: {
            deletedAt: null,
            sectionId: { in: sectionIds },
            submissionDueAt: { not: null },
            homeworkCompletions: {
              none: {
                userId,
              },
            },
          },
          include: {
            description: {
              select: {
                content: true,
              },
            },
            section: {
              include: {
                course: true,
              },
            },
          },
          orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
        })
      : [];

    const todos = user.todos.flatMap((todo) =>
      todo.dueAt
        ? [
            {
              id: todo.id,
              title: todo.title,
              content: todo.content ?? null,
              dueAt: todo.dueAt,
              priority: todo.priority,
            },
          ]
        : [],
    );

    if (
      user.subscribedSections.length === 0 &&
      homeworks.length === 0 &&
      todos.length === 0
    ) {
      return notFound("No calendar items found");
    }

    const calendar = await createUserCalendar({
      sections: user.subscribedSections,
      homeworks,
      todos,
    });
    const icsData = calendar.toString();

    return new NextResponse(icsData, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="life-ustc-subscriptions.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return handleRouteError("Failed to generate user calendar", error);
  }
}
export const GET = observedApiRoute(getRoute);
