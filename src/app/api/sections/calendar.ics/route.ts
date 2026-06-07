import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  handleRouteError,
  parseIntegerList,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { sectionsCalendarQuerySchema } from "@/lib/api/schemas/request-schemas";
import { prisma } from "@/lib/db/prisma";
import { createMultiSectionCalendar } from "@/lib/ical";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Generate calendar ICS for multiple sections.
 * @params sectionsCalendarQuerySchema
 * @response 200:binary
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: NextRequest) {
  try {
    const parsedQuery = parseRouteSearchParams(
      request.nextUrl.searchParams,
      sectionsCalendarQuerySchema,
      "sectionIds parameter is required",
      { logErrors: true },
    );
    if (parsedQuery instanceof Response) {
      return parsedQuery;
    }

    const sectionIdsParam = parsedQuery.sectionIds;

    const sectionIds = parseIntegerList(sectionIdsParam);

    if (sectionIds.length === 0) {
      return badRequest("No valid section IDs provided");
    }

    // Fetch all sections with their schedules and exams
    const sections = await prisma.section.findMany({
      where: {
        id: {
          in: sectionIds,
        },
      },
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
    });

    if (sections.length === 0) {
      return handleRouteError(
        "No sections found",
        new Error("No sections"),
        404,
      );
    }

    // Create calendar from all sections
    const calendar = await createMultiSectionCalendar(sections);
    const icsData = calendar.toString();

    return new NextResponse(icsData, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="life-ustc-schedule.ics"',
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    return handleRouteError("Failed to generate calendar", error);
  }
}
export const GET = observedApiRoute(getRoute);
