import { type NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  invalidParamResponse,
  notFound,
  parseInteger,
  parseRouteParams,
} from "@/lib/api/helpers";
import { jwIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { prisma } from "@/lib/db/prisma";
import { createSectionCalendar } from "@/lib/ical";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Generate calendar ICS for one section.
 * @pathParams jwIdPathParamsSchema
 * @response 200:binary
 * @response 404:openApiErrorSchema
 */
async function getRoute(
  _: NextRequest,
  context: { params: Promise<{ jwId: string }> },
) {
  try {
    const parsedParams = await parseRouteParams(
      context.params,
      jwIdPathParamsSchema,
      "Invalid section JW ID",
    );
    if (parsedParams instanceof Response) {
      return invalidParamResponse("section JW ID");
    }

    const { jwId } = parsedParams;
    const sectionJwId = parseInteger(jwId);

    if (sectionJwId === null) {
      return invalidParamResponse("section JW ID");
    }

    const section = await prisma.section.findUnique({
      where: { jwId: sectionJwId },
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

    if (!section) {
      return notFound("Section not found");
    }

    const calendar = await createSectionCalendar(section);
    const icsData = calendar.toString();

    return new NextResponse(icsData, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="life-ustc-${section.semesterId}-${section.code}.ics"`,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    return handleRouteError("Failed to generate calendar", error);
  }
}
export const GET = observedApiRoute(getRoute);
