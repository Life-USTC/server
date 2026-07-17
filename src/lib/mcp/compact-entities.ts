import { isRecord } from "@/lib/is-record";
import {
  asRecordArray,
  compactArrayRelations,
  compactRelations,
  pick,
  redactCalendarFeedLocation,
  transferScalarKeys,
} from "./compact-helpers";

export function compactUser(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, ["id", "name", "username", "image"]);
}

export function compactDepartment(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, [
    "id",
    "nameCn",
    "nameEn",
    "namePrimary",
    "nameSecondary",
  ]);
}

export function compactTeacherTitle(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, [
    "id",
    "nameCn",
    "nameEn",
    "namePrimary",
    "nameSecondary",
  ]);
}

export function compactCourse(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, [
    "id",
    "jwId",
    "code",
    "nameCn",
    "nameEn",
    "namePrimary",
    "nameSecondary",
    "credit",
    "hours",
  ]);
}

export function compactSemester(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, [
    "id",
    "jwId",
    "code",
    "nameCn",
    "namePrimary",
    "startDate",
    "endDate",
  ]);
}

export function compactCampus(
  value: unknown,
  options?: { includeCoordinates?: boolean },
) {
  if (!isRecord(value)) return value;
  const base = pick(value, [
    "id",
    "nameCn",
    "nameEn",
    "namePrimary",
    "nameSecondary",
  ]);
  if (options?.includeCoordinates) {
    return { ...base, ...transferScalarKeys(value, ["latitude", "longitude"]) };
  }
  return base;
}

export function compactTeacher(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "personId",
      "teacherId",
      "code",
      "jwId",
      "nameCn",
      "nameEn",
      "namePrimary",
      "nameSecondary",
    ]),
    ...compactRelations(value, {
      department: compactDepartment,
      teacherTitle: compactTeacherTitle,
    }),
    ...transferScalarKeys(value, ["_count"]),
    ...compactArrayRelations(value, { sections: compactSection }),
  };
}

export function compactSection(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "jwId",
      "code",
      "namePrimary",
      "nameSecondary",
      "campusId",
      "openDepartmentId",
    ]),
    ...compactRelations(value, {
      course: compactCourse,
      semester: compactSemester,
      campus: compactCampus,
      openDepartment: compactDepartment,
    }),
    ...compactArrayRelations(value, { teachers: compactTeacher }),
  };
}

export function compactSchedule(value: unknown) {
  if (!isRecord(value)) return value;
  const base = pick(value, [
    "id",
    "jwId",
    "date",
    "weekday",
    "startTime",
    "endTime",
    "weekIndex",
    "createdAt",
    "updatedAt",
    "customPlace",
  ]);

  if (Object.hasOwn(value, "room") && isRecord(value.room)) {
    const room = value.room;
    const roomOut: Record<string, unknown> = pick(room, [
      "id",
      "jwId",
      "namePrimary",
      "nameSecondary",
    ]);
    if (Object.hasOwn(room, "building") && isRecord(room.building)) {
      const bldg = room.building;
      const bldgOut: Record<string, unknown> = pick(bldg, [
        "id",
        "jwId",
        "namePrimary",
        "nameSecondary",
      ]);
      if (Object.hasOwn(bldg, "campus")) {
        bldgOut.campus = compactCampus(bldg.campus);
      }
      roomOut.building = bldgOut;
    }
    return {
      ...base,
      ...(Object.hasOwn(value, "section") && isRecord(value.section)
        ? { section: compactSection(value.section) }
        : {}),
      room: roomOut,
      ...compactArrayRelations(value, { teachers: compactTeacher }),
    };
  }

  return {
    ...base,
    ...compactRelations(value, { section: compactSection }),
    ...compactArrayRelations(value, { teachers: compactTeacher }),
  };
}

export function compactExam(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "jwId",
      "examDate",
      "startTime",
      "endTime",
      "createdAt",
      "updatedAt",
      "examType",
      "examMode",
      "examTakeCount",
    ]),
    ...compactRelations(value, {
      section: compactSection,
      examBatch: (v) =>
        isRecord(v)
          ? pick(v, ["id", "jwId", "namePrimary", "nameSecondary"])
          : v,
    }),
    ...(Object.hasOwn(value, "examRooms") && Array.isArray(value.examRooms)
      ? {
          examRooms: asRecordArray(value.examRooms).map((room) =>
            pick(room, [
              "id",
              "jwId",
              "roomName",
              "buildingName",
              "room",
              "count",
            ]),
          ),
        }
      : {}),
  };
}

export function compactTodo(value: unknown) {
  if (!isRecord(value)) return value;
  const base = pick(value, [
    "id",
    "title",
    "priority",
    "dueAt",
    "completed",
    "createdAt",
    "updatedAt",
  ]);
  if (!value.completed && Object.hasOwn(value, "content")) {
    return { ...base, content: value.content };
  }
  return base;
}

export function compactHomework(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "sectionId",
      "title",
      "isMajor",
      "requiresTeam",
      "publishedAt",
      "submissionStartAt",
      "submissionDueAt",
      "deletedAt",
      "createdAt",
      "updatedAt",
    ]),
    ...compactRelations(value, {
      description: (v) =>
        isRecord(v)
          ? pick(v, ["id", "content", "lastEditedAt", "lastEditedById"])
          : v,
      section: compactSection,
      createdBy: compactUser,
      updatedBy: compactUser,
      deletedBy: compactUser,
    }),
    ...transferScalarKeys(value, [
      "completion",
      "commentCount",
      "homeworkCompletions",
    ]),
  };
}

function compactBusRouteStop(value: unknown) {
  if (!isRecord(value)) return value;
  if (Object.hasOwn(value, "campus")) {
    return { stopOrder: value.stopOrder, campus: compactCampus(value.campus) };
  }
  return pick(value, ["stopOrder", "campusId", "campusName"]);
}

export function compactBusRoute(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "nameCn",
      "nameEn",
      "descriptionPrimary",
      "descriptionSecondary",
      "routeId",
      "weekdayTrips",
      "weekendTrips",
      "stopCount",
    ]),
    ...compactArrayRelations(value, { stops: compactBusRouteStop }),
    ...compactRelations(value, {
      originCampus: compactCampus,
      destinationCampus: compactCampus,
    }),
  };
}

function compactBusStopTimes(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      isRecord(item)
        ? pick(item, [
            "stopOrder",
            "campusId",
            "campusName",
            "time",
            "minutesSinceMidnight",
            "isPassThrough",
          ])
        : item,
    );
  }
  return value;
}

export function compactBusTrip(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "tripId",
      "routeId",
      "dayType",
      "position",
      "departureTime",
      "arrivalTime",
      "departureMinutes",
      "arrivalMinutes",
      "minutesUntilDeparture",
      "status",
      "departureEstimated",
      "arrivalEstimated",
    ]),
    ...compactRelations(value, {
      stopTimes: compactBusStopTimes,
      route: compactBusRoute,
      originCampus: compactCampus,
      destinationCampus: compactCampus,
    }),
  };
}

export function compactBusTripSlot(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    position: value.position,
    stopTimes: compactBusStopTimes(value.stopTimes),
  };
}

export function compactCalendarSubscription(value: unknown) {
  if (!isRecord(value)) return value;
  const sections =
    Object.hasOwn(value, "sections") && Array.isArray(value.sections)
      ? asRecordArray(value.sections).map(compactSection)
      : [];
  return {
    userId: value.userId,
    sectionCount: sections.length,
    sections,
    calendarPath:
      typeof value.calendarPath === "string"
        ? redactCalendarFeedLocation(value.calendarPath)
        : null,
    calendarUrl:
      typeof value.calendarUrl === "string"
        ? redactCalendarFeedLocation(value.calendarUrl)
        : null,
    note: value.note,
  };
}
