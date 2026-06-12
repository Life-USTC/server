import type { Prisma } from "@/generated/prisma/client";
import {
  handleRouteError,
  invalidParamResponse,
  parseInteger,
  parseRouteInput,
} from "@/lib/api/helpers";
import {
  jwIdPathParamsSchema,
  resourceIdPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { formatTime } from "@/shared/lib/time-utils";

export function parseJwIdRouteParam(params: { jwId: string }, label: string) {
  const parsedParams = parseRouteInput(params, jwIdPathParamsSchema, label);
  if (parsedParams instanceof Response) {
    return invalidParamResponse(label);
  }

  const parsedJwId = parseInteger(parsedParams.jwId);
  return parsedJwId === null ? invalidParamResponse(label) : parsedJwId;
}

export function parseResourceIdRouteParam(
  params: { id: string },
  label: string,
) {
  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    label,
  );
  if (parsedParams instanceof Response) {
    return invalidParamResponse(label);
  }

  const parsedId = parseInteger(parsedParams.id);
  return parsedId === null ? invalidParamResponse(label) : parsedId;
}

export function parseScheduleDateParam(
  name: "dateFrom" | "dateTo",
  value?: string,
) {
  if (!value) return undefined;

  const parsed = parseDateInput(value);
  return parsed instanceof Date
    ? parsed
    : handleRouteError("Invalid schedule query", `Invalid ${name}`, 400);
}

export async function buildTeacherWhere(input: {
  departmentId?: string;
  search?: string;
}) {
  const where: Prisma.TeacherWhereInput = {};

  if (input.departmentId) {
    const parsedDepartmentId = parseInteger(input.departmentId);
    if (parsedDepartmentId !== null) {
      where.departmentId = parsedDepartmentId;
    }
  }

  if (input.search) {
    const { ilike } = await import("@/lib/query-helpers");
    where.OR = [
      { nameCn: ilike(input.search) },
      { nameEn: ilike(input.search) },
      { code: ilike(input.search) },
    ];
  }

  return where;
}

export function formatScheduleTimeFields<
  Schedule extends {
    endTime: number | null;
    startTime: number | null;
  },
>(schedule: Schedule) {
  return {
    ...schedule,
    startTime: formatTime(schedule.startTime),
    endTime: formatTime(schedule.endTime),
  };
}
